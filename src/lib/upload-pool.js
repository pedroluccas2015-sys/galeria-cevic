// Bounded concurrency avoids flooding Drive or allocating many video decoders.
export async function uploadPool(items, worker, concurrency = 3) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await worker(items[index], index);
    }
  }));
}
