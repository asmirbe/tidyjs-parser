export function logMethod(target: Error, propertyKey: string, descriptor: PropertyDescriptor) {
  const originalMethod = descriptor.value;

  descriptor.value = function (...args: Error[]) {
    console.log(`Appel de la méthode ${propertyKey} avec les arguments:`, args);
    const result = originalMethod.apply(this, args);
    console.log(`Résultat de la méthode ${propertyKey}:`, result);
    return result;
  };

  return descriptor;
}