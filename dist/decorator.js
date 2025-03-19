"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMethod = logMethod;
function logMethod(target, propertyKey, descriptor) {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args) {
        console.log(`Appel de la méthode ${propertyKey} avec les arguments:`, args);
        const result = originalMethod.apply(this, args);
        console.log(`Résultat de la méthode ${propertyKey}:`, result);
        return result;
    };
    return descriptor;
}
