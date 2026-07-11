/**
 * Structural tests: DESIGN.md identity is wired into shipped CSS/theme.
 * Reads real repo files — no hard-coded pass without file content.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf-8');
}

describe('Inkline DESIGN.md → theme bridge', () => {
  it('DESIGN.md has required front matter tokens and prose sections', () => {
    const md = read('DESIGN.md');
    expect(md.startsWith('---')).toBe(true);
    expect(md).toMatch(/name:\s*Inkline/);
    expect(md).toMatch(/colors:\s*\n[\s\S]*primary:/);
    expect(md).toMatch(/typography:\s*\n/);
    expect(md).toMatch(/## Overview/);
    expect(md).toMatch(/## Colors/);
    expect(md).toMatch(/## Typography/);
    expect(md).toMatch(/## Do's and Don'ts|## Do’s and Don’ts/);
    // Brand colors from design system
    expect(md.toLowerCase()).toContain('#111111');
    expect(md.toLowerCase()).toContain('#007aff');
    expect(md.toLowerCase()).toContain('#f5f5f7');
  });

  it('Quasar variables map primary/accent away from Material blue', () => {
    const scss = read('src/css/quasar.variables.scss');
    expect(scss).toMatch(/\$primary\s*:\s*#111111/i);
    expect(scss).toMatch(/\$accent\s*:\s*#007aff/i);
    expect(scss).not.toMatch(/\$primary\s*:\s*#1976D2/i);
  });

  it('app.scss exposes CSS custom properties for DESIGN.md tokens', () => {
    const css = read('src/css/app.scss');
    expect(css).toContain('--ink-primary');
    expect(css).toContain('--ink-tertiary');
    expect(css).toContain('--ink-neutral');
    expect(css).toContain('--ink-font-serif');
    expect(css).toContain('--ink-reader-max');
    // Deep ink + clay values present
    expect(css.toLowerCase()).toContain('#111111');
    expect(css.toLowerCase()).toContain('#007aff');
  });

  it('primary surfaces use ink token classes / variables', () => {
    const layout = read('src/layouts/AppLayout.vue');
    const header = read('src/layouts/AppHeader.vue');
    const home = read('src/pages/HomePage.vue');
    const content = read('src/pages/Content.vue');
    expect(layout).toMatch(/ink-layout|ink-page-container|--ink-neutral/);
    expect(header).toMatch(/ink-header|--ink-primary/);
    expect(home).toMatch(/ink-home|--ink-/);
    expect(content).toMatch(/ink-reader|--ink-/);
  });
});
