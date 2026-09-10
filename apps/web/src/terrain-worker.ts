// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors.
import { attachTerrainWorker, type TerrainScope } from './terrain-worker-runtime.ts';
import { loadMissionScene } from './terrain-scene-loader.ts';
import { createCampaignSession } from './campaign-session.ts';
attachTerrainWorker(globalThis as unknown as TerrainScope,loadMissionScene,createCampaignSession);
