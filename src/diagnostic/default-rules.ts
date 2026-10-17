import type { DiagnosticRule } from './diagnostic-rule.js';
import { layerHiddenRule } from './rules/layer-hidden.rule.js';
import { layerOutsideExtentRule } from './rules/layer-outside-extent.rule.js';
import { layerResolutionLimitRule } from './rules/layer-resolution-limit.rule.js';
import { layerSourceUnavailableRule } from './rules/layer-source-unavailable.rule.js';
import { layerZoomLimitRule } from './rules/layer-zoom-limit.rule.js';
import { layerZeroOpacityRule } from './rules/layer-zero-opacity.rule.js';
import { mapViewInvalidRule } from './rules/map-view-invalid.rule.js';
import { sourceErrorRule } from './rules/source-error.rule.js';

export function createDefaultRules(): DiagnosticRule[] {
  return [
    mapViewInvalidRule,
    layerHiddenRule,
    layerZeroOpacityRule,
    layerZoomLimitRule,
    layerResolutionLimitRule,
    layerOutsideExtentRule,
    sourceErrorRule,
    layerSourceUnavailableRule,
  ];
}
