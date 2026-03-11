# -*- coding: utf-8 -*-
"""
@author:XuMing(xuming624@qq.com)
@description: Tests for tree-sitter based multi-language code parser.
"""
import logging
import os
import tempfile

import pytest

logger = logging.getLogger(__name__)

# Skip all tests if tree-sitter-languages not installed
ts_langs = pytest.importorskip("tree_sitter_languages", reason="tree-sitter-languages not installed")

from treesearch.parsers.treesitter_parser import (
    parse_treesitter_structure,
    treesitter_code_to_tree,
    EXT_TO_LANGUAGE,
)


# ---------------------------------------------------------------------------
# Test fixtures: sample code files for each language
# ---------------------------------------------------------------------------

PYTHON_CODE = '''\
import os


class MyClass:
    """A sample class."""

    def __init__(self, name: str):
        self.name = name

    def greet(self) -> str:
        return f"Hello, {self.name}"


def standalone_function(x: int, y: int) -> int:
    """Add two numbers."""
    return x + y


async def async_handler(request):
    return {"status": "ok"}
'''

JAVA_CODE = '''\
package com.example;

public class Calculator {
    private int value;

    public Calculator(int initial) {
        this.value = initial;
    }

    public int add(int x) {
        return this.value + x;
    }

    public static void main(String[] args) {
        Calculator calc = new Calculator(0);
        System.out.println(calc.add(5));
    }
}

interface Computable {
    int compute(int a, int b);
}
'''

GO_CODE = '''\
package main

import "fmt"

type Server struct {
    Host string
    Port int
}

func (s *Server) Start() error {
    fmt.Printf("Starting server on %s:%d\\n", s.Host, s.Port)
    return nil
}

func NewServer(host string, port int) *Server {
    return &Server{Host: host, Port: port}
}

type Logger interface {
    Log(msg string)
}
'''

RUST_CODE = '''\
use std::fmt;

pub struct Point {
    x: f64,
    y: f64,
}

impl Point {
    pub fn new(x: f64, y: f64) -> Self {
        Point { x, y }
    }

    pub fn distance(&self, other: &Point) -> f64 {
        ((self.x - other.x).powi(2) + (self.y - other.y).powi(2)).sqrt()
    }
}

impl fmt::Display for Point {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        write!(f, "({}, {})", self.x, self.y)
    }
}

pub trait Shape {
    fn area(&self) -> f64;
    fn perimeter(&self) -> f64;
}

pub fn calculate_area(shape: &dyn Shape) -> f64 {
    shape.area()
}
'''

CPP_CODE = '''\
#include <iostream>
#include <string>

namespace mylib {

class Animal {
public:
    Animal(const std::string& name) : name_(name) {}

    virtual void speak() const {
        std::cout << name_ << " speaks." << std::endl;
    }

    std::string getName() const { return name_; }

protected:
    std::string name_;
};

class Dog : public Animal {
public:
    Dog(const std::string& name) : Animal(name) {}

    void speak() const override {
        std::cout << name_ << " barks." << std::endl;
    }
};

}  // namespace mylib

int main() {
    mylib::Dog dog("Rex");
    dog.speak();
    return 0;
}
'''

TYPESCRIPT_CODE = '''\
interface UserConfig {
    name: string;
    email: string;
    age?: number;
}

class UserService {
    private users: Map<string, UserConfig>;

    constructor() {
        this.users = new Map();
    }

    addUser(config: UserConfig): void {
        this.users.set(config.name, config);
    }

    getUser(name: string): UserConfig | undefined {
        return this.users.get(name);
    }
}

function createService(): UserService {
    return new UserService();
}

export { UserService, UserConfig, createService };
'''

RUBY_CODE = '''\
module Authentication
  class User
    attr_reader :name, :email

    def initialize(name, email)
      @name = name
      @email = email
    end

    def to_s
      "#{name} <#{email}>"
    end
  end

  def self.authenticate(username, password)
    # Authentication logic
    true
  end
end
'''

KOTLIN_CODE = '''\
package com.example

data class User(val name: String, val age: Int)

class UserRepository {
    private val users = mutableListOf<User>()

    fun addUser(user: User) {
        users.add(user)
    }

    fun findByName(name: String): User? {
        return users.find { it.name == name }
    }
}

fun main() {
    val repo = UserRepository()
    repo.addUser(User("Alice", 30))
    println(repo.findByName("Alice"))
}
'''

SWIFT_CODE = '''\
import Foundation

protocol Greetable {
    func greet() -> String
}

struct Person: Greetable {
    let name: String
    let age: Int

    func greet() -> String {
        return "Hello, I'm \\(name)"
    }
}

class PersonManager {
    private var people: [Person] = []

    func add(_ person: Person) {
        people.append(person)
    }

    func findByName(_ name: String) -> Person? {
        return people.first { $0.name == name }
    }
}

func createManager() -> PersonManager {
    return PersonManager()
}
'''

PHP_CODE = '''\
<?php

namespace App\\Models;

interface Serializable {
    public function serialize(): string;
}

class User implements Serializable {
    private string $name;
    private string $email;

    public function __construct(string $name, string $email) {
        $this->name = $name;
        $this->email = $email;
    }

    public function getName(): string {
        return $this->name;
    }

    public function serialize(): string {
        return json_encode(['name' => $this->name, 'email' => $this->email]);
    }
}

function createUser(string $name, string $email): User {
    return new User($name, $email);
}
'''

CSHARP_CODE = '''\
using System;
using System.Collections.Generic;

namespace MyApp.Models
{
    public interface IRepository<T>
    {
        void Add(T item);
        T FindById(int id);
    }

    public class UserRepository : IRepository<User>
    {
        private List<User> _users = new();

        public void Add(User user)
        {
            _users.Add(user);
        }

        public User FindById(int id)
        {
            return _users.Find(u => u.Id == id);
        }
    }

    public record User(int Id, string Name, string Email);
}
'''

SCALA_CODE = '''\
package com.example

trait Printable {
  def print(): Unit
}

class Animal(val name: String) extends Printable {
  def print(): Unit = println(s"Animal: $name")

  def speak(): String = s"$name makes a sound"
}

object AnimalFactory {
  def create(name: String): Animal = new Animal(name)
}
'''


# ---------------------------------------------------------------------------
# Helper to write temp code file and parse
# ---------------------------------------------------------------------------

def _write_and_parse(code: str, ext: str) -> list[dict]:
    """Write code to a temp file and parse with tree-sitter."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=ext, delete=False, encoding="utf-8") as f:
        f.write(code)
        path = f.name
    try:
        return parse_treesitter_structure(code, ext)
    finally:
        os.unlink(path)


# ---------------------------------------------------------------------------
# Test: parse_treesitter_structure for various languages
# ---------------------------------------------------------------------------

class TestParseTreesitterStructure:
    def test_python(self):
        headings = parse_treesitter_structure(PYTHON_CODE, ".py")
        titles = [h["title"] for h in headings]
        assert any("MyClass" in t for t in titles), f"Expected MyClass in {titles}"
        assert any("greet" in t for t in titles), f"Expected greet in {titles}"
        assert any("standalone_function" in t for t in titles), f"Expected standalone_function in {titles}"
        assert any("async_handler" in t for t in titles), f"Expected async_handler in {titles}"
        # Check levels
        class_h = [h for h in headings if "MyClass" in h["title"]][0]
        assert class_h["level"] == 1
        func_h = [h for h in headings if "standalone_function" in h["title"]][0]
        assert func_h["level"] == 2

    def test_java(self):
        headings = parse_treesitter_structure(JAVA_CODE, ".java")
        titles = [h["title"] for h in headings]
        assert any("Calculator" in t for t in titles), f"Expected Calculator in {titles}"
        assert any("add" in t for t in titles), f"Expected add in {titles}"
        assert any("Computable" in t for t in titles), f"Expected Computable in {titles}"

    def test_go(self):
        headings = parse_treesitter_structure(GO_CODE, ".go")
        titles = [h["title"] for h in headings]
        assert any("Server" in t for t in titles), f"Expected Server in {titles}"
        assert any("Start" in t for t in titles), f"Expected Start in {titles}"
        assert any("NewServer" in t for t in titles), f"Expected NewServer in {titles}"
        assert any("Logger" in t for t in titles), f"Expected Logger in {titles}"

    def test_rust(self):
        headings = parse_treesitter_structure(RUST_CODE, ".rs")
        titles = [h["title"] for h in headings]
        assert any("Point" in t for t in titles), f"Expected Point in {titles}"
        assert any("Shape" in t for t in titles), f"Expected Shape in {titles}"
        assert any("calculate_area" in t for t in titles), f"Expected calculate_area in {titles}"
        # impl blocks
        impl_headings = [h for h in headings if "impl" in h["title"].lower() or h["level"] == 1]
        assert len(impl_headings) >= 2, f"Expected at least 2 impl/struct headings, got {impl_headings}"

    def test_cpp(self):
        headings = parse_treesitter_structure(CPP_CODE, ".cpp")
        titles = [h["title"] for h in headings]
        assert any("Animal" in t for t in titles), f"Expected Animal in {titles}"
        assert any("Dog" in t for t in titles), f"Expected Dog in {titles}"
        assert any("main" in t for t in titles), f"Expected main in {titles}"

    def test_typescript(self):
        headings = parse_treesitter_structure(TYPESCRIPT_CODE, ".ts")
        titles = [h["title"] for h in headings]
        assert any("UserService" in t for t in titles), f"Expected UserService in {titles}"
        assert any("UserConfig" in t for t in titles), f"Expected UserConfig in {titles}"
        assert any("createService" in t for t in titles), f"Expected createService in {titles}"

    def test_ruby(self):
        headings = parse_treesitter_structure(RUBY_CODE, ".rb")
        titles = [h["title"] for h in headings]
        assert any("Authentication" in t for t in titles) or any("module" in t.lower() for t in titles), \
            f"Expected Authentication module in {titles}"
        assert any("User" in t for t in titles), f"Expected User in {titles}"

    def test_kotlin(self):
        headings = parse_treesitter_structure(KOTLIN_CODE, ".kt")
        titles = [h["title"] for h in headings]
        assert any("UserRepository" in t for t in titles), f"Expected UserRepository in {titles}"
        assert any("addUser" in t for t in titles) or any("findByName" in t for t in titles), \
            f"Expected methods in {titles}"

    def test_swift(self):
        """Swift may not be available in all tree-sitter-languages builds."""
        headings = parse_treesitter_structure(SWIFT_CODE, ".swift")
        # Swift might not be in EXT_TO_LANGUAGE if unavailable
        if ".swift" not in EXT_TO_LANGUAGE:
            assert headings == []
            return
        titles = [h["title"] for h in headings]
        if titles:
            assert any("Person" in t for t in titles), f"Expected Person in {titles}"

    def test_php(self):
        headings = parse_treesitter_structure(PHP_CODE, ".php")
        titles = [h["title"] for h in headings]
        assert any("User" in t for t in titles), f"Expected User in {titles}"
        assert any("Serializable" in t for t in titles), f"Expected Serializable in {titles}"

    def test_csharp(self):
        headings = parse_treesitter_structure(CSHARP_CODE, ".cs")
        titles = [h["title"] for h in headings]
        assert any("UserRepository" in t for t in titles), f"Expected UserRepository in {titles}"
        assert any("IRepository" in t for t in titles), f"Expected IRepository in {titles}"

    def test_scala(self):
        headings = parse_treesitter_structure(SCALA_CODE, ".scala")
        titles = [h["title"] for h in headings]
        assert any("Animal" in t for t in titles), f"Expected Animal in {titles}"
        assert any("Printable" in t for t in titles) or any("trait" in t.lower() for t in titles), \
            f"Expected Printable trait in {titles}"
        assert any("AnimalFactory" in t for t in titles) or any("object" in t.lower() for t in titles), \
            f"Expected AnimalFactory object in {titles}"

    def test_unsupported_extension(self):
        headings = parse_treesitter_structure("some code", ".xyz_unknown")
        assert headings == []

    def test_empty_source(self):
        headings = parse_treesitter_structure("", ".py")
        assert headings == []

    def test_syntax_error_does_not_crash(self):
        """tree-sitter is error-tolerant, should not crash on bad syntax."""
        bad_code = "def foo(\n    class Bar:\n        pass\n    )"
        headings = parse_treesitter_structure(bad_code, ".py")
        # Should not raise, may return partial results
        assert isinstance(headings, list)


class TestTreesitterLineNumbers:
    """Verify that extracted line numbers are accurate."""

    def test_python_line_numbers(self):
        headings = parse_treesitter_structure(PYTHON_CODE, ".py")
        # class MyClass starts at line 4
        class_h = [h for h in headings if "MyClass" in h["title"]]
        assert len(class_h) == 1
        assert class_h[0]["line_num"] == 4
        # def standalone_function starts at line 14
        func_h = [h for h in headings if "standalone_function" in h["title"]]
        assert len(func_h) == 1
        assert func_h[0]["line_num"] == 14

    def test_go_line_numbers(self):
        headings = parse_treesitter_structure(GO_CODE, ".go")
        # type Server struct starts at line 5
        server_h = [h for h in headings if "Server" in h["title"] and h["level"] == 1]
        assert len(server_h) >= 1
        assert server_h[0]["line_num"] == 5


class TestTreesitterCodeToTree:
    """Test the full treesitter_code_to_tree async function."""

    @pytest.mark.asyncio
    async def test_python_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(PYTHON_CODE)
            path = f.name
        try:
            result = await treesitter_code_to_tree(
                code_path=path,
                if_add_node_summary=False,
                if_add_node_id=True,
            )
            assert "doc_name" in result
            assert "structure" in result
            assert "source_path" in result
            assert os.path.isabs(result["source_path"])
            assert len(result["structure"]) > 0

            from treesearch.tree import flatten_tree
            nodes = flatten_tree(result["structure"])
            assert all("node_id" in n for n in nodes)
            assert all("line_start" in n for n in nodes)
            assert all("line_end" in n for n in nodes)
            # Should find class and function nodes
            titles = [n["title"] for n in nodes]
            assert any("MyClass" in t for t in titles)
            assert any("standalone_function" in t for t in titles)
        finally:
            os.unlink(path)

    @pytest.mark.asyncio
    async def test_go_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".go", delete=False, encoding="utf-8") as f:
            f.write(GO_CODE)
            path = f.name
        try:
            result = await treesitter_code_to_tree(
                code_path=path,
                if_add_node_summary=False,
                if_add_node_id=True,
            )
            assert len(result["structure"]) > 0
            from treesearch.tree import flatten_tree
            nodes = flatten_tree(result["structure"])
            titles = [n["title"] for n in nodes]
            assert any("Server" in t for t in titles)
        finally:
            os.unlink(path)

    @pytest.mark.asyncio
    async def test_rust_file(self):
        with tempfile.NamedTemporaryFile(mode="w", suffix=".rs", delete=False, encoding="utf-8") as f:
            f.write(RUST_CODE)
            path = f.name
        try:
            result = await treesitter_code_to_tree(
                code_path=path,
                if_add_node_summary=False,
                if_add_node_id=True,
            )
            assert len(result["structure"]) > 0
        finally:
            os.unlink(path)


class TestExtToLanguageMapping:
    """Verify the extension to language mapping."""

    def test_common_extensions_mapped(self):
        assert EXT_TO_LANGUAGE[".py"] == "python"
        assert EXT_TO_LANGUAGE[".java"] == "java"
        assert EXT_TO_LANGUAGE[".go"] == "go"
        assert EXT_TO_LANGUAGE[".rs"] == "rust"
        assert EXT_TO_LANGUAGE[".ts"] == "typescript"
        assert EXT_TO_LANGUAGE[".js"] == "javascript"
        assert EXT_TO_LANGUAGE[".cpp"] == "cpp"
        assert EXT_TO_LANGUAGE[".rb"] == "ruby"
        assert EXT_TO_LANGUAGE[".kt"] == "kotlin"
        assert EXT_TO_LANGUAGE[".cs"] == "c_sharp"
        assert EXT_TO_LANGUAGE[".php"] == "php"
        assert EXT_TO_LANGUAGE[".scala"] == "scala"

    def test_all_mapped_languages_are_loadable(self):
        """Verify tree-sitter can load parsers for all mapped languages."""
        import warnings
        from tree_sitter_languages import get_parser as ts_get_parser
        failed = []
        for ext, lang in EXT_TO_LANGUAGE.items():
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore", FutureWarning)
                    ts_get_parser(lang)
            except Exception as e:
                failed.append((ext, lang, str(e)))
        if failed:
            # Some languages may not be available in all builds
            logger.warning("Some tree-sitter parsers not available: %s", failed)
        # Core languages must work
        core_langs = ["python", "java", "go", "rust", "cpp", "c", "javascript", "typescript",
                      "ruby", "kotlin", "c_sharp", "php", "scala"]
        core_failed = [(ext, lang, err) for ext, lang, err in failed if lang in core_langs]
        assert not core_failed, f"Core language parsers failed: {core_failed}"
