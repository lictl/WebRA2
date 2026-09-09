/* SPDX-License-Identifier: LGPL-2.1-or-later
 * Original WebRA2 retained Bink decoder; FFmpeg is linked separately. */
#include <stdint.h>
#include <stdlib.h>
#include <errno.h>
#include <math.h>
#include <emscripten.h>
#include <libavformat/avformat.h>
#include <libavcodec/avcodec.h>
#include <libavutil/imgutils.h>
#include <libavutil/opt.h>
#include <libswscale/swscale.h>
#include <libswresample/swresample.h>

#define MAX_OUTPUT (1024 * 768 * 4)
#define MAX_INPUT (128 * 1024 * 1024)
static AVFormatContext *fmt;
static AVIOContext *io;
static AVCodecContext *video, *audio, *active;
static AVFrame *frame;
static AVPacket *packet;
static struct SwsContext *sws;
static SwrContext *swr;
static uint8_t *output;
static int vi, ai, eof_stage, event_kind, event_bytes, event_samples;
static int width, height, sample_rate, channels;
static int64_t cursor, input_size;
static double event_pts, event_duration;
static int64_t event_ticks, audio_next;
static int event_num, event_den;

EM_JS(int, source_read, (int address, int length, double offset), {
  return Module.readSource(address, length, offset);
});
static int read_packet(void *opaque, uint8_t *buffer, int size) {
  (void)opaque;
  if (cursor >= input_size) return AVERROR_EOF;
  if (size > 32768) size = 32768;
  if (size > input_size - cursor) size = (int)(input_size - cursor);
  int result = source_read((int)(uintptr_t)buffer, size, (double)cursor);
  if (result != size) return AVERROR(EIO);
  cursor += result;
  return result;
}
static int64_t seek_source(void *opaque, int64_t offset, int whence) {
  (void)opaque;
  if (whence == AVSEEK_SIZE) return input_size;
  whence &= ~AVSEEK_FORCE;
  if (offset < -MAX_INPUT || offset > MAX_INPUT) return AVERROR(EINVAL);
  int64_t target = whence == SEEK_SET ? offset : whence == SEEK_CUR ? cursor + offset : whence == SEEK_END ? input_size + offset : -1;
  if (target < 0 || target > input_size) return AVERROR(EINVAL);
  cursor = target;
  return target;
}
EMSCRIPTEN_KEEPALIVE void wm_close(void) {
  avcodec_free_context(&video); avcodec_free_context(&audio);
  av_frame_free(&frame); av_packet_free(&packet);
  sws_freeContext(sws); sws = NULL;
  swr_free(&swr);
  if (fmt) avformat_close_input(&fmt);
  if (io) { av_freep(&io->buffer); avio_context_free(&io); }
  av_freep(&output);
  active = NULL; vi = ai = -1; eof_stage = 0;
}
static int open_codec(int index, AVCodecContext **ctx) {
  if (index < 0) return 0;
  AVStream *stream = fmt->streams[index];
  const AVCodec *codec = avcodec_find_decoder(stream->codecpar->codec_id);
  if (!codec) return AVERROR_DECODER_NOT_FOUND;
  *ctx = avcodec_alloc_context3(codec);
  if (!*ctx) return AVERROR(ENOMEM);
  int result = avcodec_parameters_to_context(*ctx, stream->codecpar);
  if (result < 0) return result;
  (*ctx)->pkt_timebase = stream->time_base;
  (*ctx)->thread_count = 1;
  (*ctx)->max_pixels = 1024 * 768;
  return avcodec_open2(*ctx, codec, NULL);
}
EMSCRIPTEN_KEEPALIVE int wm_open(int size, int track) {
  wm_close();
  if (size <= 0 || size > MAX_INPUT || track < -1 || track > 7) return AVERROR(EINVAL);
  av_log_set_level(AV_LOG_QUIET);
  av_max_alloc(32 * 1024 * 1024);
  input_size = size; cursor = 0; audio_next = 0;
  fmt = avformat_alloc_context();
  uint8_t *buffer = av_malloc(32768);
  if (!fmt || !buffer) { av_free(buffer); return AVERROR(ENOMEM); }
  io = avio_alloc_context(buffer, 32768, 0, NULL, read_packet, NULL, seek_source);
  if (!io) { av_free(buffer); return AVERROR(ENOMEM); }
  fmt->pb = io; fmt->flags |= AVFMT_FLAG_CUSTOM_IO;
  const AVInputFormat *bink = av_find_input_format("bink");
  int result = avformat_open_input(&fmt, NULL, bink, NULL);
  if (result < 0) return result;
  int audio_ordinal = 0;
  for (unsigned i = 0; i < fmt->nb_streams; i++) {
    if (fmt->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_VIDEO && vi < 0) vi = i;
    if (fmt->streams[i]->codecpar->codec_type == AVMEDIA_TYPE_AUDIO && audio_ordinal++ == track) ai = i;
  }
  if (vi < 0 || (track >= 0 && ai < 0)) return AVERROR_STREAM_NOT_FOUND;
  if ((result = open_codec(vi, &video)) < 0 || (result = open_codec(ai, &audio)) < 0) return result;
  width = video->width; height = video->height;
  if (width <= 0 || height <= 0 || width > 1024 || height > 768) return AVERROR(EINVAL);
  channels = audio ? audio->ch_layout.nb_channels : 0;
  sample_rate = audio ? audio->sample_rate : 0;
  if (audio && (channels < 1 || channels > 2 || sample_rate < 8000 || sample_rate > 96000)) return AVERROR(EINVAL);
  frame = av_frame_alloc(); packet = av_packet_alloc(); output = av_malloc(MAX_OUTPUT);
  if (!frame || !packet || !output) return AVERROR(ENOMEM);
  return 0;
}
static int emit_frame(AVCodecContext *ctx) {
  int stream_index = ctx == video ? vi : ai;
  int64_t pts = frame->best_effort_timestamp;
  if (pts == AV_NOPTS_VALUE && ctx == audio) pts = audio_next;
  if (pts == AV_NOPTS_VALUE || pts < 0) return AVERROR_INVALIDDATA;
  event_ticks = pts;
  event_num = fmt->streams[stream_index]->time_base.num; event_den = fmt->streams[stream_index]->time_base.den;
  event_pts = pts * av_q2d(fmt->streams[stream_index]->time_base);
  if (ctx == video) {
    if (frame->width != width || frame->height != height) return AVERROR_INVALIDDATA;
    sws = sws_getCachedContext(sws, width, height, frame->format, width, height, AV_PIX_FMT_RGBA, SWS_BILINEAR | SWS_BITEXACT, NULL, NULL, NULL);
    if (!sws) return AVERROR(ENOMEM);
    uint8_t *planes[] = { output, NULL, NULL, NULL }; int strides[] = { width * 4, 0, 0, 0 };
    if (sws_scale(sws, (const uint8_t * const *)frame->data, frame->linesize, 0, height, planes, strides) != height) return AVERROR_INVALIDDATA;
    event_kind = 1; event_bytes = width * height * 4; event_samples = 0;
    event_duration = av_q2d(fmt->streams[vi]->time_base);
  } else {
    if (frame->sample_rate != sample_rate || frame->ch_layout.nb_channels != channels || frame->nb_samples < 0 || frame->nb_samples > 65536) return AVERROR_INVALIDDATA;
    if (!swr) {
      int result = swr_alloc_set_opts2(&swr, &frame->ch_layout, AV_SAMPLE_FMT_FLT, sample_rate, &frame->ch_layout, frame->format, sample_rate, 0, NULL);
      if (result < 0 || !swr || (result = swr_init(swr)) < 0) return result < 0 ? result : AVERROR(ENOMEM);
    }
    uint8_t *planes[] = { output };
    int count = swr_convert(swr, planes, MAX_OUTPUT / (channels * 4), (const uint8_t **)frame->extended_data, frame->nb_samples);
    if (count < 0) return count;
    event_kind = 2; event_samples = count; event_bytes = count * channels * 4;
    event_duration = (double)count / sample_rate;
    audio_next = pts + count;
  }
  av_frame_unref(frame);
  return event_kind;
}
EMSCRIPTEN_KEEPALIVE int wm_next(void) {
  if (!fmt || !video || !output) return AVERROR(EINVAL);
  /* A single request consumes bounded packets even on silent/unknown streams. */
  for (int work = 0; work < 4096; work++) {
    if (active) {
      int result = avcodec_receive_frame(active, frame);
      if (result == 0) return emit_frame(active);
      if (result != AVERROR(EAGAIN) && result != AVERROR_EOF) return result;
      active = NULL;
    }
    if (eof_stage) {
      if (eof_stage == 1) { eof_stage = 2; active = video; }
      else if (eof_stage == 2 && audio) { eof_stage = 3; active = audio; }
      else return 0;
      int result = avcodec_send_packet(active, NULL);
      if (result < 0 && result != AVERROR_EOF) return result;
      continue;
    }
    int result = av_read_frame(fmt, packet);
    if (result == AVERROR_EOF) { eof_stage = 1; continue; }
    if (result < 0) return result;
    active = packet->stream_index == vi ? video : packet->stream_index == ai ? audio : NULL;
    if (active) result = avcodec_send_packet(active, packet);
    av_packet_unref(packet);
    if (active && result < 0) return result;
  }
  return AVERROR(ELOOP);
}
EMSCRIPTEN_KEEPALIVE int wm_seek(double seconds) {
  if (!fmt || !isfinite(seconds) || seconds < 0 || seconds > 600) return AVERROR(EINVAL);
  int64_t timestamp = (int64_t)(seconds / av_q2d(fmt->streams[vi]->time_base));
  int result = av_seek_frame(fmt, vi, timestamp, AVSEEK_FLAG_BACKWARD);
  if (result < 0) return result;
  avcodec_flush_buffers(video); if (audio) avcodec_flush_buffers(audio);
  swr_free(&swr); av_packet_unref(packet); av_frame_unref(frame);
  active = NULL; eof_stage = 0; audio_next = 0;
  return 0;
}
EMSCRIPTEN_KEEPALIVE int wm_data(void) { return (int)(uintptr_t)output; }
EMSCRIPTEN_KEEPALIVE int wm_bytes(void) { return event_bytes; }
EMSCRIPTEN_KEEPALIVE int wm_samples(void) { return event_samples; }
EMSCRIPTEN_KEEPALIVE int wm_width(void) { return width; }
EMSCRIPTEN_KEEPALIVE int wm_height(void) { return height; }
EMSCRIPTEN_KEEPALIVE int wm_rate(void) { return sample_rate; }
EMSCRIPTEN_KEEPALIVE int wm_channels(void) { return channels; }
EMSCRIPTEN_KEEPALIVE double wm_pts(void) { return event_pts; }
EMSCRIPTEN_KEEPALIVE double wm_duration(void) { return event_duration; }

EMSCRIPTEN_KEEPALIVE double wm_ticks(void) { return (double)event_ticks; }
EMSCRIPTEN_KEEPALIVE int wm_num(void) { return event_num; }
EMSCRIPTEN_KEEPALIVE int wm_den(void) { return event_den; }
