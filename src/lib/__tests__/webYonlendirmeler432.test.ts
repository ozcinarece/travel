// #432 2/3b (UX notu): web'de `/r/g/{24}` alıcı sayfasına, `/r/{8}` davet sayfasına gider; özel kural genel kuraldan önce.
import { describe, expect, it } from '@jest/globals';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

describe('web-yonlendirmeler', () => {
  it('/r/g/:token kuralı /r/:token kuralından önce gelir ve kendi sayfasına gider', () => {
    const kok = fs.mkdtempSync(path.join(os.tmpdir(), 'dist-'));
    fs.mkdirSync(path.join(kok, 'r', 'g'), { recursive: true });
    fs.writeFileSync(path.join(kok, 'r', '[token].html'), 'davet');
    fs.writeFileSync(path.join(kok, 'r', 'g', '[token].html'), 'paylasim');
    execFileSync('node', [path.join(__dirname, '../../../scripts/web-yonlendirmeler.js'), kok], { stdio: 'pipe' });
    const kurallar = fs.readFileSync(path.join(kok, '_redirects'), 'utf8').trim().split('\n');
    const gi = kurallar.indexOf('/r/g/:token /r/g/_token 200');
    const di = kurallar.indexOf('/r/:token /r/_token 200');
    expect(gi).toBeGreaterThanOrEqual(0);
    expect(di).toBeGreaterThan(gi);
    expect(fs.readFileSync(path.join(kok, 'r', 'g', '_token.html'), 'utf8')).toBe('paylasim');
    expect(fs.readFileSync(path.join(kok, 'r', '_token.html'), 'utf8')).toBe('davet');
  });
});
