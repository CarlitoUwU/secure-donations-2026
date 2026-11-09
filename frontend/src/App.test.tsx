import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';

afterEach(cleanup);

test('CA-01.3 presenta el estado vacío del catálogo en una sección accesible', () => {
  render(<App />);

  const catalog = screen.getByRole('region', { name: 'Proyectos publicados' });
  expect(within(catalog).getByText('Aún no hay proyectos publicados.')).toBeTruthy();
});
