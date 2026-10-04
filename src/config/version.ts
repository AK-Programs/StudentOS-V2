/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Centralized StudentOS Application Version & Release Metadata
 */

export const APP_VERSION = '2.9.0';
export const APP_BUILD_ID = 'build-2026.10-release';
export const APP_NAME = 'StudentOS';
export const APP_CODENAME = 'Orion Nova';
export const APP_RELEASE_CYCLE = 'Production v2.9';

export interface VersionInfo {
  version: string;
  buildId: string;
  name: string;
  codename: string;
  releaseCycle: string;
}

export function getAppVersionInfo(): VersionInfo {
  return {
    version: APP_VERSION,
    buildId: APP_BUILD_ID,
    name: APP_NAME,
    codename: APP_CODENAME,
    releaseCycle: APP_RELEASE_CYCLE
  };
}
