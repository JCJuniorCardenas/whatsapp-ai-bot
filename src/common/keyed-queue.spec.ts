import { KeyedQueue } from './keyed-queue';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe('KeyedQueue', () => {
  it('ejecuta en orden las tareas de la misma clave, aunque la primera tarde más', async () => {
    const queue = new KeyedQueue();
    const order: string[] = [];
    const a = queue.run('ana', async () => {
      await delay(30);
      order.push('a1');
    });
    const b = queue.run('ana', async () => {
      order.push('a2');
    });
    await Promise.all([a, b]);
    expect(order).toEqual(['a1', 'a2']);
  });

  it('claves distintas corren en paralelo', async () => {
    const queue = new KeyedQueue();
    const order: string[] = [];
    const lenta = queue.run('ana', async () => {
      await delay(30);
      order.push('ana');
    });
    const rapida = queue.run('beto', async () => {
      order.push('beto');
    });
    await Promise.all([lenta, rapida]);
    expect(order).toEqual(['beto', 'ana']);
  });

  it('un error no traba las tareas siguientes de la misma clave', async () => {
    const queue = new KeyedQueue();
    const fallida = queue.run('ana', async () => {
      throw new Error('boom');
    });
    const siguiente = queue.run('ana', async () => 'ok');
    await expect(fallida).rejects.toThrow('boom');
    await expect(siguiente).resolves.toBe('ok');
  });

  it('devuelve el resultado de la tarea', async () => {
    expect(await new KeyedQueue().run('x', async () => 42)).toBe(42);
  });

  it('no acumula claves una vez que terminó todo', async () => {
    const queue = new KeyedQueue();
    await queue.run('ana', async () => undefined);
    await delay(5);
    expect(queue.size).toBe(0);
  });
});
