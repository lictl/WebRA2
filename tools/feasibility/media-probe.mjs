const input = document.querySelector('#media');
const stop = document.querySelector('#stop');
const output = document.querySelector('#media-results');
let worker;
let timer;
function report(value) {
  output.replaceChildren(...JSON.stringify(value, null, 2).split('\n').map(line => {
    const row = document.createElement('span');
    row.textContent = line;
    return row;
  }));
}
function cleanup() {
  clearTimeout(timer);
  worker?.terminate();
  worker = undefined;
  stop.disabled = true;
  input.disabled = false;
  input.value = '';
}
input.addEventListener('change', async () => {
  const file = input.files?.[0];
  if (!file) return;
  if (file.size > 64 * 1024 * 1024 || file.size < 44) {
    report({ status: 'rejected', reason: 'Sample must be 44 bytes to 64 MiB.' });
    input.value = '';
    return;
  }
  input.disabled = true;
  stop.disabled = false;
  report({ status: 'loading local core and sample', sourceBytes: file.size });
  worker = new Worker('/media-worker.mjs', { type: 'module' });
  worker.onmessage = event => {
    report(event.data);
    if (event.data.status !== 'running') cleanup();
  };
  worker.onerror = event => { report({ status: 'failed', message: event.message }); cleanup(); };
  timer = setTimeout(() => { report({ status: 'terminated', reason: '60 second diagnostic timeout' }); cleanup(); }, 60000);
  worker.postMessage(file);
});
stop.addEventListener('click', () => { report({ status: 'terminated by user' }); cleanup(); });
