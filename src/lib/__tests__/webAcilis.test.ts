/** @jest-environment jsdom */
import { expect, test } from '@jest/globals';
import { WEB_ACILIS_ID, webAcilisiKaldir } from '@/lib/webAcilis';

test('#549: açılış katmanı ve stili kaldırılır, React kökü kalır', () => {
  document.body.innerHTML = `<style id="${WEB_ACILIS_ID}-stil"></style><div id="${WEB_ACILIS_ID}"></div><div id="root"></div>`;
  webAcilisiKaldir();
  expect(document.getElementById(WEB_ACILIS_ID)).toBeNull();
  expect(document.getElementById(`${WEB_ACILIS_ID}-stil`)).toBeNull();
  expect(document.getElementById('root')).not.toBeNull();
  // Katman yoksa sessiz.
  expect(() => webAcilisiKaldir()).not.toThrow();
});
