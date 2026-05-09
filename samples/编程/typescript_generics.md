# TypeScript Generics and Advanced Types

## Why Generics Matter

TypeScript generics allow you to write flexible, reusable code that maintains full type safety. Rather than using `any` and losing type information, generics preserve types through functions, classes, and interfaces, enabling the compiler to catch errors before runtime.

## Generic Functions

### Basic Syntax
```typescript
// A generic identity function
function identity<T>(value: T): T {
    return value;
}

const num = identity(42);        // Type: number
const str = identity("hello");    // Type: string
```

### Multiple Type Parameters
```typescript
function merge<T, U>(first: T, second: U): T & U {
    return { ...first, ...second };
}

const result = merge({ name: "Alice" }, { age: 30 });
// Type: { name: string } & { age: number }
```

### Generic Constraints
```typescript
interface HasLength {
    length: number;
}

function logLength<T extends HasLength>(value: T): T {
    console.log(value.length);
    return value;
}

logLength("hello");        // OK: string has .length
logLength([1, 2, 3]);     // OK: array has .length
// logLength(123);         // Error: number doesn't have .length
```

### Using keyof with Generics
```typescript
function getProperty<T, K extends keyof T>(obj: T, key: K): T[K] {
    return obj[key];
}

const user = { name: "Alice", age: 30, email: "alice@example.com" };
const name = getProperty(user, "name");  // Type: string
const age = getProperty(user, "age");    // Type: number
// getProperty(user, "phone");           // Error: "phone" is not a key of user
```

## Conditional Types

Conditional types enable type-level programming — choosing types based on conditions:

```typescript
// Basic conditional type
type IsString<T> = T extends string ? true : false;

type A = IsString<string>;  // true
type B = IsString<number>;  // false
```

### infer Keyword
The `infer` keyword allows you to extract types from within conditional types:

```typescript
// Extract return type of a function
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type FnReturn = ReturnType<() => string>;  // string
type FnReturn2 = ReturnType<(x: number) => boolean>;  // boolean

// Extract element type from an array
type ElementType<T> = T extends (infer E)[] ? E : never;

type Item = ElementType<string[]>;  // string
type Item2 = ElementType<number[]>; // number

// Extract promise resolved type
type Awaited<T> = T extends Promise<infer U> ? Awaited<U> : T;

type Resolved = Awaited<Promise<string>>;        // string
type Nested = Awaited<Promise<Promise<number>>>; // number
```

### Distributive Conditional Types
When a conditional type acts on a union type, it distributes across each member:

```typescript
type ToArray<T> = T extends any ? T[] : never;

type Result = ToArray<string | number>;
// Result = string[] | number[] (distributed)
// NOT (string | number)[]

// To prevent distribution, wrap in a tuple:
type ToArrayNonDist<T> = [T] extends [any] ? T[] : never;
type Result2 = ToArrayNonDist<string | number>;  // (string | number)[]
```

## Mapped Types

Mapped types create new types by transforming each property of an existing type:

```typescript
// Make all properties optional
type Optional<T> = {
    [K in keyof T]?: T[K];
};

// Make all properties readonly
type Readonly<T> = {
    readonly [K in keyof T]: T[K];
};

// Make all properties required (remove optional)
type Required<T> = {
    [K in keyof T]-?: T[K];  // -? removes optional modifier
};

// Make all properties mutable
type Mutable<T> = {
    -readonly [K in keyof T]: T[K];  // -readonly removes readonly
};
```

### Template Literal Types
```typescript
type EventName = "click" | "focus" | "blur";
type EventHandler = `on${Capitalize<EventName>}`;
// "onClick" | "onFocus" | "onBlur"

type CSSProperty = "margin" | "padding";
type CSSDirection = "top" | "right" | "bottom" | "left";
type CSSRule = `${CSSProperty}-${CSSDirection}`;
// "margin-top" | "margin-right" | ... | "padding-left"
```

### Key Remapping
```typescript
// Add a prefix to all property names
type PrefixKeys<T, P extends string> = {
    [K in keyof T as `${P}${Capitalize<string & K>}`]: T[K];
};

type User = { name: string; age: number };
type PrefixedUser = PrefixKeys<User, "user">;
// { userName: string; userAge: number }
```

## Utility Type Patterns

### DeepPartial
```typescript
type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends object
        ? T[K] extends any[]
            ? T[K]
            : DeepPartial<T[K]>
        : T[K];
};

interface Config {
    database: {
        host: string;
        port: number;
        credentials: {
            username: string;
            password: string;
        };
    };
    cache: {
        enabled: boolean;
        ttl: number;
    };
}

type PartialConfig = DeepPartial<Config>;
// All nested properties are optional
```

### Builder Pattern Type
```typescript
classQueryBuilder<T extends object> {
    private filters: Partial<T> = {};

    where<K extends keyof T>(key: K, value: T[K]): this {
        this.filters[key] = value;
        return this;
    }

    build(): Partial<T> {
        return { ...this.filters };
    }
}

// Type-safe chained calls
const query = new QueryBuilder<User>()
    .where("name", "Alice")
    .where("age", 30)
    // .where("name", 123)  // Error: number is not assignable to string
    .build();
```

### Branded Types
```typescript
// Prevent accidental mixing of similar types
type Brand<T, B> = T & { __brand: B };

type USD = Brand<number, "USD">;
type EUR = Brand<number, "EUR">;

function processPayment(amount: USD): void { /* ... */ }

const usd = 100 as USD;
const eur = 100 as EUR;

processPayment(usd);   // OK
// processPayment(eur); // Error: EUR is not assignable to USD
```

## Type Guards

### User-Defined Type Guards
```typescript
interface Dog { bark(): void; breed: string; }
interface Cat { meow(): void; purr: boolean; }

function isDog(pet: Dog | Cat): pet is Dog {
    return "bark" in pet;
}

function handlePet(pet: Dog | Cat) {
    if (isDog(pet)) {
        pet.bark();     // TypeScript knows pet is Dog
    } else {
        pet.meow();     // TypeScript knows pet is Cat
    }
}
```

### Assertion Functions
```typescript
function assertDefined<T>(value: T | undefined | null): asserts value is T {
    if (value === undefined || value === null) {
        throw new Error("Expected value to be defined");
    }
}

const maybeUser: User | undefined = getUser();
assertDefined(maybeUser);
console.log(maybeUser.name); // TypeScript knows it's User
```

## Best Practices

1. Prefer generics over `any` to preserve type information
2. Use built-in utility types (`Partial`, `Required`, `Pick`, `Omit`, `Record`) before defining custom ones
3. Keep generic constraints minimal — over-constraining reduces reusability
4. Use descriptive names for type parameters in public APIs (`TItem` instead of `T`)
5. Leverage `satisfies` operator (TypeScript 4.9+) for type checking without widening
