const parseVersion = (value: unknown): number[] | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value
    .trim()
    .match(/^v?(\d+(?:\.\d+)*)(?:[-+][0-9A-Za-z]+(?:[.-][0-9A-Za-z]+)*)?$/i);

  if (!match) {
    return null;
  }

  const segments = match[1].split('.').map(Number);
  return segments.every(Number.isSafeInteger) ? segments : null;
};

export const requiresForcedUpdate = (
  currentVersion: unknown,
  minimumVersion: unknown,
): boolean => {
  const current = parseVersion(currentVersion);
  const minimum = parseVersion(minimumVersion);

  if (!current || !minimum) {
    return false;
  }

  const segmentCount = Math.max(current.length, minimum.length);

  for (let index = 0; index < segmentCount; index += 1) {
    const currentSegment = current[index] ?? 0;
    const minimumSegment = minimum[index] ?? 0;

    if (currentSegment < minimumSegment) {
      return true;
    }

    if (currentSegment > minimumSegment) {
      return false;
    }
  }

  return false;
};
