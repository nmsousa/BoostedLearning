import { TestBed } from '@angular/core/testing';
import { FeedbackService } from './feedback.service';
import { SettingsService } from './settings.service';
import { environment } from '../../environments/environment';

describe('FeedbackService (offline reports)', () => {
  const settings = {
    testerName: () => 'Tester',
    baseLanguage: () => 'en', learningLanguage: () => 'fr',
    effectiveTheme: () => 'dark', colorTheme: () => 'ocean',
  };
  let service: FeedbackService;
  const originalFetch = globalThis.fetch;
  const originalEndpoint = environment.feedbackEndpoint;

  beforeEach(() => {
    localStorage.removeItem('boostionary.feedbackQueue');
    (environment as { feedbackEndpoint: string }).feedbackEndpoint = 'https://example.test/feedback';
    TestBed.configureTestingModule({ providers: [{ provide: SettingsService, useValue: settings }] });
    service = TestBed.inject(FeedbackService);
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    (environment as { feedbackEndpoint: string }).feedbackEndpoint = originalEndpoint;
  });

  it('sends the report when online', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    expect(await service.submit({ reasons: ['audioWrong'] })).toBe('sent');
    expect(service.pending).toBe(0);
  });

  it('saves the report offline instead of opening email, then sends it later', async () => {
    globalThis.fetch = vi.fn(async () => { throw new TypeError('offline'); }) as unknown as typeof fetch;
    const before = window.location.href;
    expect(await service.submit({ reasons: ['audioWrong'], word: 'bonjour' })).toBe('queued');
    expect(window.location.href).toBe(before); // no mailto:
    expect(service.pending).toBe(1);

    globalThis.fetch = vi.fn(async () => ({ ok: true })) as unknown as typeof fetch;
    await service.flushQueue();
    expect(service.pending).toBe(0);
  });

  it('keeps a queued report while the server is still unreachable', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false })) as unknown as typeof fetch;
    await service.submit({ reasons: ['x'] });
    await service.flushQueue();
    expect(service.pending).toBe(1);
  });
});
