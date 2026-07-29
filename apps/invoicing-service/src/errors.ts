export class NotFoundError   extends Error { constructor(m: string) { super(m); this.name = 'NotFoundError'; } }
export class ForbiddenError  extends Error { constructor(m: string) { super(m); this.name = 'ForbiddenError'; } }
export class ConflictError   extends Error { constructor(m: string) { super(m); this.name = 'ConflictError'; } }
export class BadRequestError extends Error { constructor(m: string) { super(m); this.name = 'BadRequestError'; } }
