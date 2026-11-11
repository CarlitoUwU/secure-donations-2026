import { expect, test } from 'vitest';
import { createDemoApi } from './demoApi';

const projectInput = { title: 'Campaña de prueba', description: 'Material escolar', goalAmountCents: 50000 };

test('el gestor puede retomar un borrador local y publicarlo en el catálogo', async () => {
  const api = createDemoApi([]);
  const draft = await api.createProject(projectInput);
  expect((await api.listProjects()).items).toEqual([]);
  expect(await api.listDrafts()).toEqual([draft]);

  await api.editProject(draft.projectId, { title: 'Campaña editada' });
  const published = await api.publishProject(draft.projectId);
  expect(published).toMatchObject({ title: 'Campaña editada', status: 'PUBLICADO' });
  expect((await api.listProjects()).items).toEqual([published]);
  expect(await api.listDrafts()).toEqual([]);
});

test('la demo conserva la respuesta inicial al reintentar y suma una sola confirmación', async () => {
  const api = createDemoApi([]);
  const draft = await api.createProject(projectInput);
  const { projectId } = await api.publishProject(draft.projectId);
  const input = { projectId, amountCents: 1550 };
  const key = crypto.randomUUID();

  const donation = await api.createDonation(input, key);
  await expect(api.createDonation({ ...input, amountCents: 1600 }, key)).rejects.toMatchObject({ status: 409 });
  await api.simulateDonation(donation.donationId, 'CONFIRMADA_SIMULADA');
  await expect(api.simulateDonation(donation.donationId, 'CONFIRMADA_SIMULADA')).rejects.toMatchObject({ status: 409 });
  expect(await api.createDonation(input, key)).toEqual(donation);
  expect((await api.listDonations()).items).toHaveLength(1);
  expect((await api.getProject(projectId)).confirmedAmountCents).toBe(1550);

  const rejected = await api.createDonation(input, crypto.randomUUID());
  await api.simulateDonation(rejected.donationId, 'RECHAZADA_SIMULADA');
  expect((await api.getProject(projectId)).confirmedAmountCents).toBe(1550);
});
