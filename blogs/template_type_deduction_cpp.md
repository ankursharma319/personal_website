## Templates in C++

Templates are a compile time construct in C++. When you declare and define a template, you are telling the compiler, hey if any other code is using this particular function/class, you need to take the template I have provided you and fill in the blanks and generate the specfic complete function or class which accept that particular type.

For e.g. -

```cpp
template<typename T>
T my_add(T x, T y) {
    return x + y;
}

my_add(1, 2);
my_add(2.0f, 23.4f);
my_add(std::string("hello"), std::string("world"));
```

After compilation, this essentially transforms into -

```cpp
int my_add(int x, int y) {
    return x + y;
}

float my_add(float x, float y) {
    return x + y;
}

std::string my_add(std::string x, std::string y) {
    return x + y;
}

// and rest of the function calls
```

Templates by themselves do nothing. Its only when a template is instantiated by using it, that the function/class code is actually generated for that particular type.

Since the templates are expanded at compile time, `my_add(std::string("bad"), 3)` will be a compile time error, because the template we declared expects both arguments to be of the same type T.

## Trivial type deduction

In the above example, you may have noticed that the type T was deduced to be `int` for `my_add(1, 2)` and `float` for `my_add(2.0f, 23.4f)` and `std::string` for `my_add(std::string("hello"), std::string("world"))`.

In this case its not that difficult to deduce what the type ends up being. But if you are relatively new to templates and are anything like me, you might be curious as to how this type deduction works when you bring in things like pointers, references and const modifiers. In that case, you should read on. As a bonus, type deduction for templates also applies for `auto` keyword, so you are killing two birds with one stone here.

Even though templates can both be classes and functions, in this post, I will only talk about function templates to keep things simple, but the ideas also apply to class templates.

## Pointers

Pointers are probably the easiest. This is because pointers are really a whole new type. From the perspective of a template `int` and `int *` are completely different types and there is no relation between them whatsover.

So reusing the same example above,

```cpp
int a = 3;
int b = 4;
my_add(&a, &b);
```

will generate a completely new instantiation of the function template:

```cpp
int* my_add(int* x, int* y) {
    return x + y;
}
```

So its completely possible for `T` to deduce to a pointer type.

There might be cases where you want a function or class to only accept pointer types or to not accept pointer types. For e.g. a template declared as:

```cpp
template<typename T>
void my_foo(T* t) {
    // do something with t
}
```

will only allow `t` to be pointer types. For e.g. calling `my_foo(101)` will result in a compile time error because 101 is not a pointer type.

## Const modifiers

If your function template is like this:

```cpp
template<typename T>
void my_foo(T t) {
    // do something with t
}
```

what do you think `T` deduces to when we pass a const int like `int const x=3; my_foo(x);`?
Well its still just `int`. Since we are creating a copy it does not really matter whether `my_foo` mutates its copy of the parameter.

What if I want a function template to only instantiate the function where `T` is always a const copy? Well, its simple enough:

```cpp
template<typename T>
void my_foo(T const t) {
    // do something with t
}
```

Const is generally more useful when dealing with references (and pointers) to indicate whether we can expect a function to mutate a value or not, so read on.

## References

So there are really 3 main types of references you will use in c++ generally.

 - l-value const references (also simply known as const references) (`int const&`)
 - l-value references (`int&`)
 - r-value references (`int&&`)

A function which accepts l-value references cannot accept const values but a function which accepts const references can accept non-const l-value references also. This ofcourse makes sense, because l-value references (`int&`) can be modified by a function, so you dont want to pass a const value to these functions.

Passing a r-value to a function which accepts const references is fine, but passing a r-value to function which accepts l-value references will result in a compile time error.

To understand more about the rvalue references and move semantics in C++11, you can do a lot worse than reading [this wonderful post on stackoverflow](https://stackoverflow.com/a/11540204/1827375).

How many different instantiations of `my_foo` do you think the below code would produce?

```cpp
template<typename T>
void my_foo(T t) {
    // do something with t
}

int x=3;
my_foo<int>(x);
my_foo<int&>(x);
// fails to compile because cant pass a r-value as non-const l-value reference
//my_foo<int&>(3);
my_foo<int&&>(3);
my_foo<int const&>(x);
my_foo<int const&>(3);
```

The answer is 4, where `T` is `int`, `int&`, `int&&` and `int const&`.

But you might have noticed I explicitly specifed the exact type I want to call `my_foo` using `<...>` at each call. But if I didnt and just called `my_foo(...)` directly, then it will just always create a copy and deduce `T` to `int`.

So if you want your template functions to create instantiations in which T deduces to references and copies as well, you might have to explicitly specify that.

If you want to create a function template which only accepts l-value references or const-references, it is possible to do something obvious like this:

```cpp
template<typename T>
void my_foo(T& t) {
    // do something with t
}
```

Now, calling `my_foo(x)` wont create a copy but pass a reference. Or

```cpp
template<typename T>
void my_foo(T const& t) {
    // do something with t
}
```

In this case, calling `my_foo(x)` will pass a const reference.

Follwing on with this logic, what do you think the following template function would accept as parameter?

```cpp
template<typename T>
void my_foo(T&& t) {
    // do something with t
}
```

Obvious thing to assume would be that it only accepts r-values -
so far example `my_foo(1)` in which case `T&&` is `int&&` and `int x=1; my_foo(std::move(x));` in which case also `T&&` is `int&&`.

But you would be wrong. In addition to the above cases, `int x=1; my_foo(x);` is also legal and `T&&` deduces to `int&`. Suprised? Well so was I. Welcome to the strange world of C++.

## Forwarding function template

```cpp
template<typename T>
void my_foo(T&& t) {
    // do something with t
}

int x = 3;
my_foo(x);
```

Due to a special rule, `T` is deduced to be `int&`, hence `T&&` would mean something like `int& &&`. But C++ has no notion of references to references, the type `int& &&` is collapsed into `int&`.

Why do we have this special rule? Well, its to allow for perfect forwarding. Essentially we want to able to write a template function that can receive any type and forward it to another function as is without changing its l-valueness or r-valueness.

When a function receives a rvalue of templated type, it is refered to as forwarding reference or universal reference since it can be either lvalue or rvalue.


for e.g.:

```cpp
void baz(T&& val) {
  (void) val;
}

void bar(T&& val) {
    baz(val);
}
```

`bar` accepts a universal reference `val`. Even though `val` can be an r-value, at the same time it also has a name and in that sense it is very similar to a l-value. So, val is actually not passed as a r-value to `baz`. Its passed as a l-value reference. So you would need to do another `std::move(val)` inside `bar` in order to pass the val as an r-value. But remember, `val` is a universal reference so it could also be a l-value. And we dont want to pass that as an r-value but rather an l-value. So using `std::move` is not correct in the general case.

When dealing with deduced template types, we should use `std::forward` to pass the argument, it makes sure that if the input was a rvalue, it essentially returns a rvalue reference and if the input was a simple lvalue reference, it returns a lvalue.

So the correct code looks like:

```cpp
void baz(T&& val) {
  (void) val;
}

void bar(T&& val) {
    baz(std::forward<T>(val));
}
```
