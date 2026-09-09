// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright 2026 WebRA2 contributors. Bundled dedicated-worker entry.
import { inspectInstallation } from '../../../packages/vfs/src/browser-import.ts';
import { attachImportWorker, type ImportWorkerScope } from './import-worker-runtime.ts';
attachImportWorker(globalThis as unknown as ImportWorkerScope, inspectInstallation);
