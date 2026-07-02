import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Auto-cleanup the RTL DOM after each test. This is normally handled
// automatically when globals:true is set, but with globals:false we call it
// explicitly so DOM state doesn't bleed across tests.
afterEach(() => {
  cleanup();
});
