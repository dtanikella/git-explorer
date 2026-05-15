export interface Serializable {
  serialize(): string;
}

export interface Printable {
  print(): void;
}

export type ID = string | number;

export class BaseModel {
  id: ID;
  constructor(id: ID) {
    this.id = id;
  }
}

export class User extends BaseModel implements Serializable {
  constructor(id: ID, public name: string) {
    super(id);
  }

  serialize(): string {
    return JSON.stringify({ id: this.id, name: this.name });
  }
}
