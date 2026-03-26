/**
 * AccessiSimulate - Color Blindness Matrices
 * SVG feColorMatrix values for each type of color vision deficiency.
 * Based on Machado et al. (2009) and Brettel et al. (1997) research.
 */

window.COLOR_MATRICES = {
  /**
   * Protanopia — Red-blind (missing L-cone)
   * ~8% of males. Red appears dark, green/yellow are confused.
   */
  protanopia: [
    0.1525, 1.0525, -0.2050, 0, 0,
    0.1145, 0.7863,  0.0992, 0, 0,
   -0.0039,-0.0481,  1.0520, 0, 0,
    0,      0,       0,      1, 0
  ].join(' '),

  /**
   * Deuteranopia — Green-blind (missing M-cone)
   * ~6% of males. Cannot distinguish red from green.
   */
  deuteranopia: [
    0.3667, 0.8667, -0.2333, 0, 0,
    0.2667, 0.7333,  0,      0, 0,
   -0.0286, 0.0286,  1,      0, 0,
    0,      0,       0,      1, 0
  ].join(' '),

  /**
   * Tritanopia — Blue-blind (missing S-cone)
   * ~0.01% of people. Blue/yellow confusion, blue appears green.
   */
  tritanopia: [
    1,      0.1667, -0.1667, 0, 0,
    0,      0.8333,  0.1667, 0, 0,
    0,      0.4167,  0.5833, 0, 0,
    0,      0,       0,      1, 0
  ].join(' ')
};

/**
 * Human-readable descriptions for each mode.
 */
window.SIMULATION_INFO = {
  protanopia: {
    label: 'Red-Blind (Protanopia)',
    description: '~8% of males. Red tones disappear — red error messages, red CTA buttons become invisible.',
    icon: '🔴',
    pillar: 'colorblind'
  },
  deuteranopia: {
    label: 'Green-Blind (Deuteranopia)',
    description: '~6% of males. Green and red are indistinguishable — "success" vs "error" indicators become the same.',
    icon: '🟢',
    pillar: 'colorblind'
  },
  tritanopia: {
    label: 'Blue-Blind (Tritanopia)',
    description: 'Rare but powerful. Blue/yellow confusion — link colors, info boxes, sky-blue UI all affected.',
    icon: '🔵',
    pillar: 'colorblind'
  },
  lowvision: {
    label: 'Low Vision (Blur + Low Contrast)',
    description: 'Simulates cataracts or uncorrected refractive error. Small text and low-contrast elements become illegible.',
    icon: '👁️',
    pillar: 'visual'
  },
  tunnel: {
    label: 'Tunnel Vision (Macular Degeneration)',
    description: 'Only the center of the screen is visible. Navigation menus and peripheral content are completely invisible.',
    icon: '🕳️',
    pillar: 'visual'
  },
  screenreader: {
    label: 'Screen Reader Mode',
    description: 'Page becomes semi-transparent. Elements are narrated in DOM order using speech synthesis.',
    icon: '🔊',
    pillar: 'visual'
  },
  keyboard: {
    label: 'Keyboard-Only Mode',
    description: 'Mouse is completely disabled. Only Tab, Shift+Tab, Enter, Space, and arrows work. Tab order is visualized.',
    icon: '⌨️',
    pillar: 'motor'
  },
  tabtrap: {
    label: 'Tab Trap Detector',
    description: 'Normal browsing + automatic detection of focus traps, missing aria-labels, and unreachable elements.',
    icon: '🪤',
    pillar: 'motor'
  },
  slowmotor: {
    label: 'Tremor / Slow Motor',
    description: 'Simulates hand tremor. Interactive elements shake on hover, exposing dangerously small click targets.',
    icon: '🤲',
    pillar: 'motor'
  }
};
