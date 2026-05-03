# Rust Ownership and Borrowing: A Comprehensive Guide

## The Ownership System: Rust's Defining Feature

Rust's ownership system is what makes the language unique. It provides memory safety guarantees at compile time without requiring a garbage collector, enabling performance comparable to C and C++ while eliminating entire categories of bugs: use-after-free, double-free, dangling pointers, and data races.

## The Three Rules of Ownership

1. Each value in Rust has exactly one **owner** — a variable that owns it
2. When the owner goes out of scope, the value is **dropped** (memory is freed)
3. There can only be **one mutable reference** or **any number of immutable references**, but not both at the same time

## Ownership Transfer (Move Semantics)

Unlike languages with garbage collection, Rust does not implicitly copy heap-allocated data:

```rust
fn main() {
    let s1 = String::from("hello");
    let s2 = s1; // s1 is MOVED to s2, s1 is no longer valid

    // println!("{}", s1); // ERROR: value borrowed here after move
    println!("{}", s2);   // OK: s2 is the new owner
}
```

This behavior prevents double-free bugs because only one variable is responsible for freeing the memory. When `s2` goes out of scope, the String is freed once.

### Clone for Deep Copy
When you actually need a deep copy, use `.clone()`:

```rust
let s1 = String::from("hello");
let s2 = s1.clone(); // Deep copy, both s1 and s2 are valid
println!("{} {}", s1, s2); // Both work
```

### Copy Trait for Stack-Only Types
Types that are entirely stored on the stack implement the `Copy` trait and are automatically copied:

```rust
let x: i32 = 5;
let y = x; // x is copied (i32 implements Copy)
println!("{} {}", x, y); // Both work

// Types implementing Copy: i32, f64, bool, char, tuples of Copy types
// Types NOT implementing Copy: String, Vec<T>, Box<T>
```

## Borrowing and References

Borrowing allows you to reference data without taking ownership:

### Immutable References
```rust
fn calculate_length(s: &String) -> usize {
    s.len()
} // s goes out of scope but since it doesn't have ownership, nothing happens

fn main() {
    let s1 = String::from("hello");
    let len = calculate_length(&s1); // Borrow s1
    println!("'{}' has length {}", s1, len); // s1 is still valid
}
```

### Mutable References
```rust
fn append_world(s: &mut String) {
    s.push_str(", world");
}

fn main() {
    let mut s = String::from("hello");
    append_world(&mut s);
    println!("{}", s); // "hello, world"
}
```

### The Borrowing Rules
The borrowing rules are enforced at compile time:

```rust
fn main() {
    let mut s = String::from("hello");

    // RULE: Multiple immutable borrows are OK
    let r1 = &s;
    let r2 = &s;
    println!("{} {}", r1, r2); // Both valid

    // RULE: Mutable borrow requires exclusive access
    let r3 = &mut s; // OK: r1 and r2 are no longer used
    r3.push_str(" world");
    println!("{}", r3);

    // RULE: Cannot have mutable AND immutable references simultaneously
    // let r4 = &s;     // ERROR: cannot borrow as immutable
    // let r5 = &mut s; // ERROR: cannot borrow as mutable
}
```

These rules prevent data races at compile time — if two threads could mutate data simultaneously, the program would not compile.

## Lifetimes

Lifetimes are Rust's way of ensuring that references are always valid. The borrow checker uses lifetimes to verify that no reference outlives the data it points to:

### The Problem
```rust
fn longest(x: &str, y: &str) -> &str {
    if x.len() > y.len() { x } else { y }
}
// ERROR: the compiler cannot determine which reference is returned
// and therefore cannot guarantee the lifetime of the return value
```

### Lifetime Annotations
```rust
fn longest<'a>(x: &'a str, y: &'a str) -> &'a str {
    if x.len() > y.len() { x } else { y }
}
// Tells the compiler: the return value lives as long as
// the shorter of the two input lifetimes
```

### Lifetime Elision Rules
In many cases, the compiler can infer lifetimes automatically:

```rust
// These are equivalent:
fn first_word(s: &str) -> &str { ... }
fn first_word<'a>(s: &'a str) -> &'a str { ... }

// Rules:
// 1. Each elided lifetime in input becomes a distinct lifetime
// 2. If there's exactly one input lifetime, it's assigned to all elided outputs
// 3. If there are multiple input lifetimes but one is &self or &mut self,
//    that lifetime is assigned to all elided outputs
```

### Struct Lifetimes
```rust
struct Parser<'a> {
    content: &'a str,
}

impl<'a> Parser<'a> {
    fn new(content: &'a str) -> Self {
        Parser { content }
    }

    fn find(&self, pattern: &str) -> Option<&'a str> {
        self.content.find(pattern).map(|i| &self.content[i..])
    }
}
```

## Zero-Cost Abstractions

Rust's ownership system enables abstractions that have no runtime cost:

### Iterators
```rust
let sum: i32 = (1..=100)
    .filter(|&x| x % 2 == 0)
    .map(|x| x * x)
    .sum();
// Compiles to the same machine code as a hand-written loop
```

### Option Instead of Null
```rust
fn find_user(id: u32) -> Option<User> {
    // No null pointer exceptions possible
    database.get(id)
}

match find_user(42) {
    Some(user) => println!("Found: {}", user.name),
    None => println!("Not found"),
}
```

### Result Instead of Exceptions
```rust
fn read_file(path: &str) -> Result<String, io::Error> {
    fs::read_to_string(path)
}

// ? operator propagates errors ergonomically
fn process() -> Result<(), Box<dyn Error>> {
    let content = read_file("data.txt")?;
    let parsed = parse(content)?;
    Ok(())
}
```

## Smart Pointers

### Box<T> - Heap Allocation
```rust
let b = Box::new(5); // Allocate on the heap
println!("b = {}", b);
```

### Rc<T> - Reference Counting (Single-Threaded)
```rust
use std::rc::Rc;

let a = Rc::new(vec![1, 2, 3]);
let b = Rc::clone(&a); // Reference count increases
let c = Rc::clone(&a); // Reference count = 3
// All three share the same data
```

### Arc<T> - Atomic Reference Counting (Multi-Threaded)
```rust
use std::sync::Arc;
use std::thread;

let data = Arc::new(vec![1, 2, 3]);
for _ in 0..3 {
    let data = Arc::clone(&data);
    thread::spawn(move || {
        println!("{:?}", data);
    });
}
```

Rust's ownership system represents a fundamental shift in how programmers think about memory management. While the learning curve is steep, the reward is software that is memory-safe and data-race-free by construction, without sacrificing performance.
