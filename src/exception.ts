export class ComranetError extends Error {
    constructor(msg: string) {
        super(msg);

        // Set the prototype explicitly.
        Object.setPrototypeOf(this, ComranetError.prototype);
    }

    printError() {
        return this.message;
    }
}