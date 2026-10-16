/**
 * Ejecuta tareas de a una por clave, en orden de llegada. Tareas de claves distintas
 * corren en paralelo. Sirve para que los mensajes de una misma persona no se pisen.
 */
export class KeyedQueue {
  private readonly tails = new Map<string, Promise<unknown>>();

  run<T>(key: string, task: () => Promise<T>): Promise<T> {
    const previous = this.tails.get(key) ?? Promise.resolve();
    // Corre aunque la tarea anterior haya fallado: un error no traba a la persona.
    const result = previous.then(
      () => task(),
      () => task(),
    );
    const tail = result.catch(() => undefined);
    this.tails.set(key, tail);
    void tail.then(() => {
      if (this.tails.get(key) === tail) this.tails.delete(key); // no acumular claves
    });
    return result;
  }

  /** Cantidad de claves con tareas en curso (para tests). */
  get size(): number {
    return this.tails.size;
  }
}
