import { describe, it, expect, vi } from 'vitest';
import { extractProfileFromImages } from '../profile/vision.js';

const IMAGES = [{ base64: 'aaaa', mimeType: 'image/png' }];

/** A fake vision engine returning a canned text body. */
const engineReturning = (text) => ({ name: 'fake', generateVision: vi.fn(async () => text) });

const PROFILE_JSON = JSON.stringify({
  fullName: 'Jane Doe',
  headline: 'Senior Engineer',
  location: 'Dubai',
  skills: ['Node.js', 'PostgreSQL'],
  experience: [{ company: 'Acme', title: 'Senior Engineer', startDate: '2021-03', endDate: 'Present', description: 'Payments.' }],
});

describe('extractProfileFromImages', () => {
  it('throws a friendly error when the engine cannot read images', async () => {
    const textOnly = { name: 'ollama', generate: vi.fn() };
    await expect(extractProfileFromImages(IMAGES, textOnly)).rejects.toThrow(/can.?t read images|switch/i);
  });

  it('parses the returned JSON into a normalized profile', async () => {
    const engine = engineReturning(PROFILE_JSON);
    const p = await extractProfileFromImages(IMAGES, engine);
    expect(p.fullName).toBe('Jane Doe');
    expect(p.skills).toEqual(['Node.js', 'PostgreSQL']);
    expect(p.experience[0]).toMatchObject({ company: 'Acme', title: 'Senior Engineer' });
    // normalized shape: every array key present even if absent from the model output
    expect(p).toHaveProperty('certifications');
    expect(Array.isArray(p.languages)).toBe(true);
  });

  it('tolerates a ```json fenced code block', async () => {
    const p = await extractProfileFromImages(IMAGES, engineReturning('```json\n' + PROFILE_JSON + '\n```'));
    expect(p.fullName).toBe('Jane Doe');
  });

  it('forwards the images to the engine', async () => {
    const engine = engineReturning(PROFILE_JSON);
    await extractProfileFromImages(IMAGES, engine);
    expect(engine.generateVision).toHaveBeenCalledTimes(1);
    expect(engine.generateVision.mock.calls[0][0].images).toBe(IMAGES);
  });

  it('throws when the model returns no usable JSON', async () => {
    await expect(extractProfileFromImages(IMAGES, engineReturning('I could not read that.')))
      .rejects.toThrow(/could not read|no profile/i);
  });
});
