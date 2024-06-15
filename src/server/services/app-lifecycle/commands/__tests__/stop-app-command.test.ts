import { createAppConfig, getAppById, insertApp } from '@/server/tests/apps.factory';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import waitForExpect from 'wait-for-expect';
import { EventDispatcher } from '@/server/core/EventDispatcher';
import { TestDatabase, clearDatabase, closeDatabase, createDatabase } from '@/server/tests/test-utils';
import { AppQueries } from '@/server/queries/apps/apps.queries';
import { StopAppCommand } from '../stop-app-command';

let db: TestDatabase;
const TEST_SUITE = 'stopappcommand';
const dispatcher = new EventDispatcher();
let stopApp: StopAppCommand;

beforeAll(async () => {
  db = await createDatabase(TEST_SUITE);
  stopApp = new StopAppCommand({ queries: new AppQueries(db.db), eventDispatcher: dispatcher });
});

beforeEach(async () => {
  await clearDatabase(db);
  dispatcher.dispatchEventAsync = vi.fn().mockResolvedValue({ success: true });
});

afterAll(async () => {
  await closeDatabase(db);
  await dispatcher.close();
});

describe('Stop app', () => {
  it('should stop app', async () => {
    // arrange
    const appConfig = createAppConfig({ form_fields: [{ type: 'text', label: '', required: true, env_variable: 'TEST_FIELD' }] });
    await insertApp({ status: 'running' }, appConfig, db);

    // act
    await stopApp.execute({ appId: appConfig.id });

    // assert
    const app = await getAppById(appConfig.id, db);
    expect(app?.status).toBe('stopping');

    await waitForExpect(async () => {
      const app = await getAppById(appConfig.id, db);
      expect(app?.status).toBe('stopped');
    });
  });

  it('should throw if app is not installed', async () => {
    await expect(stopApp.execute({ appId: 'any' })).rejects.toThrow('APP_ERROR_APP_NOT_FOUND');
  });

  it('should put status to running if event fails', async () => {
    // arrange
    const appConfig = createAppConfig({ form_fields: [{ type: 'text', label: '', required: true, env_variable: 'TEST_FIELD' }] });
    await insertApp({ status: 'running' }, appConfig, db);
    dispatcher.dispatchEventAsync = vi.fn().mockResolvedValue({ success: false });

    // act
    await stopApp.execute({ appId: appConfig.id });

    // assert
    await waitForExpect(async () => {
      const app = await getAppById(appConfig.id, db);
      expect(app?.status).toBe('running');
    });
  });
});
