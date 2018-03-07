[![Build Status](https://travis-ci.org/IronCoreLabs/FutureJS.svg?branch=master)](https://travis-ci.org/IronCoreLabs/FutureJS)
[![NPM Version](https://badge.fury.io/js/futurejs.svg)](https://www.npmjs.com/package/futurejs)

# FutureJS

A library that expands and improves upon the general concepts supported by Promises. Provides improved control flow of asynchronous operations that are also lazy and not run until asked. 

## Reasoning

Promises in JavaScript are great start, but they're somewhat limited in the ways you can use them to control the flow of asynchronous operations. Async operations can be easily chained within Promises, but chaining async and synchronous operations together is a bit confusing and requires more code than should be necessary. 

In addition, Promises are eager, meaning that it will kick off your action as soon as your Promise constructor is invoked. This means you cannot pass around Promises without running them.

Futures provide better granular control over data flow and are also lazy. The Future chain that you construct will not kick off until you tell it to. That means you can pass them around between functions and only run them when necessary. This library also provides a number of useful control functions for chaining async actions with synchronous actions, handling error cases, and doing parallel operations. You can also use this library to wrap Promises to convert them to Futures as well as back into Promises. This allows you to integrate with existing APIs which only talk Promises.

## Installation

`npm install --save futurejs` 

or

`yarn add futurejs`

## Types

This library is written in TypeScript and published to NPM as JavaScript. TypeScript types are provided as part of this repo, but you can also look at the source to get a better sense of how the functions are typed.

## API

### Constructor

`new Future<L, R>((reject: (e: L) => void, resolve: (result: R) => void) => void)`

Futures are constructed by providing a function which will be invoked with two callbacks, `reject` and `resolve`. The function you provide to the constructor will not be run until you run the Future (explained later). Within this function you'll perform your async operation and invoke the `resolve` action with your successful result or the `reject` action with an `Error` (or similar) on failure.

```js
//Successful action
new Future((reject, resolve) => {
    setTimeout(() => {
        resolve('It worked!');
    }, 1000);
});

//Failure action
new Future((reject, resolve) => {
    setTimeout(() => {
        reject(new Error('It failed.'));
    }, 1000);
});
```

### engage

`engage(reject: (e: L) => void, resolve: (result: R) => void): void`

As mentioned earlier, Futures are lazy and won't evaluate your constructor action until you ask. This evaluation can be done via the `engage` function. Calling this function will start your Future chain. The `engage` method takes two function arguments which are the functions to execute on success or failure of the Future computation.

```js
const request = new Future((reject, resolve) => {
    setTimeout(() => {
        resolve('It worked!');
    }, 1000);
});

request.engage(
    (error) => {/*handle Error scenario*/},
    (result) => {/*handle successful fetch response*/}
);
```

### toPromise

`toPromise(): Promise<R>`

You can also convert your Future chain back into a Promise using the `toPromise` method. This function can be used as an alternative to the `engage` method as it will also kick off computation of your Future. 

```js
const request = new Future((reject, resolve) => {
    setTimeout(() => {
        resolve('It worked!');
    }, 1000);
});

request
    .toPromise()
    .then(() => ...)
    .catch(() => ...)
```

### flatMap

`flatMap<T>(next: (data: R) => Future<L, T>): Future<L, T>`

Run another asynchronous operation in sequence based on the prior Futures resolution value. This second operation will only be run if the first operation succeeded. This operation works similar to how you can chain Promises by returning a new Promise in the `then` callback.

```js
const request = new Future((reject, resolve) => {
    setTimeout(() => {
        resolve('It worked!');
    }, 1000);
});

request.flatMap((fetchResult) => {
    return new Future(() => fetch('/some/other/api/request'));
});
```

### map 

`map<T>(mapper: (data: ResultType) => T): Future<L, T>`

Run a synchronous operation that maps the prior Futures resolution value to a different value. This function is also useful if you need to decision off a prior resolution value to resolve or reject the Future.

```js
const request = new Future((reject, resolve) => {
    setTimeout(() => {
        resolve('It worked!');
    }, 1000);
});

request.map((fetchResult) => {
    //Convert the resolution of this Future from the fetch() Response type to a boolean based on the status field
    return fetchResult.status === '204';
});
```

### errorMap

`errorMap<LB>(mapper: (error: Error) => LB): Future<LB, R>`

Map but for the reject case. Allows you to modify Error objects that might occur during the chain.

```js
const request = new Future((reject, resolve) => {
    setTimeout(() => {
        resolve('It worked!');
    }, 1000);
});

request.errorMap((error) => {
    if(error.message.contains('no network')){
        return new Error('Please connect to a network before making requests.');
    }
    return error;
});
```

### handleWith

`handleWith<RepairedType extends ResultType>(errHandler: (e: Error) => Future<L, RepairedType>): Future<L, RepairedType>;`

Recover from an error in your Future chain and return a repaired result that can be passed to the rest of your chain. This allows you to possibly recover from an error if there are scenarios where error conditions shouldn't be propagated out from your computation. This method will not be invoked if the prior chain does not error, but it will be invoked if any of the prior chains failed, so placement of the `handleWith` call is important to avoid catch all situations. 

```js
const request = new Future((reject, resolve) => {
    setTimeout(() => {
        reject(new Error('forced failure'));
    }, 1000);
});

request.handleWith((fetchError) => {
    //Convert the error case from the failed fetch() into something that can be handled in the rest of the chain
    return {requestFailed: true};
});
```

### tryF (static)

`Future.tryF<L extends Error, R>(fn: () => R): Future<L, R>;`

Creates a Future which will attempt to execute the provided function and will resolve with it's returned value. If the function throws an exception then the Future will be rejected with the throw exception.

```js
const parse = Future.tryF()
```

### tryP (static)

`tryP<L extends Error, R>(fn: () => Promise<R>): Future<L, R>;`

Creates a Future which will execute the provided function which should return a Promise. The `.then` and `.catch` methods for the Promise will resolve the Future.

```js
const request = Future.tryP(() => fetch('/some/api/endpoint'));

request.engage(
    () => console.log('Request to API failed'),
    (response) => {
        console.log(response.statusCode);
    }
)
```

### of (static)

`Future.of<R>(result: R): Future<never, R>;`

Creates a Future which will be immediately resolved with the provided value once computation is kicked off. This function is equivalent to `Promise.resolve()` except that it is still lazily evaluated.

```js
const fixed = Future.of({foo: 'bar'});

fixed.engage(
    () => console.log('will never happen'),
    console.log //Will log {"foo": "bar"}
)
```

### reject (static)

`reject<L>(error: L): Future<L, never>;`

Creates a Future which will be immediately rejected with the provided Error once computation is kicked off. This function is equivalent to `Promise.reject()` except that it is still lazily evaluated.

```js
const request = Future.tryP(() => fetch('/some/api/request'));

request.flatMap((result) => {
    if(result.statusCode ===  200){
        return Future.of(true);
    }
    return Future.reject(new Error(result.status));
});
```

### encase (static)

`encase<L extends Error, R, A>(fn: (a: A) => R, a: A): Future<L, R>;`

Creates a Future from a function and a value. It will then invoke the function with the value and resolve with the result or reject with any exception thrown by the method. This function is roughly the same as `tryF` but allows you to pass a single argument to the function.

```js
const parse = Future.encase(JSON.parse, '{"foo":"bar"}');

parse.engage(
    (e) => console.log(e.message), 
    console.log //Will log {"foo": "bar"} as an object
);
```

### gather2 (static)

`gather2<T1, T2>(future1: Future<T1>, future2: Future<T2>): Future<[T1, T2]>;`

Runs two Futures together in parallel which resolve in different result types. If either of the futures reject then the Future that this returns will reject as well. The resulting arrays values will be fixed by the parameter index. That is, the resolved value from the first Future will be in the 0 index of the array while the resolved value from the second Future will be in the 1 index of the array.

```js
const requests = Future.all(
    Future.tryP(() => fetch('/api/request/one')),
    Future.tryP(() => fetch('/api/request/two'));
);

requests.engage(
    (error) => /*error from the first Future that rejected*/,
    (result) => /*result[0] is success from request/one and result[1] is success from request/two*/
)
```


### gather3 (static)

`gather3<T1, T2, T3>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>): Future<[T1, T2, T3]>`

Same as above, but runs three Futures together in parallel which resolve in different result types.

### gather4 (static)

`gather4<T1, T2, T3, T4>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>, future4: Future<T4>): Future<[T1, T2, T3, T4]>`

Same as above, but runs four Futures together in parallel which resolve in different result types.

### all (static)

`all<T>(futures: Array<Future<T>>): Future<T[]>`

Same as above but runs an arbitrary number of Futures in parallel, all of which result in the same result type.


## License

[MIT licensed](LICENSE)
