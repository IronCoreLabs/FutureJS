# FutureJS

A library that expands and improves upon the general concepts supported by Promises. Provides improved control flow of asynchronous operations that are also lazy and not run until asked. 

## Reasoning

Promises in JavaScript are great start, but they're somewhat limited in the ways you can use them to control the flow of asynchronous operations. Async operations can be easily chained within Promises, but chaining async and synchronous operations together is a bit confusing and requires more code than should be necessary. 

In addition, Promises are eager, meaning that it will kick off your action as soon as your Promise constructor is invoked. This means you cannot pass around Promises without running them.

Futures provide better granular control over data flow and are also lazy. The Future chain that you construct will not kick off until you tell it to. That means you can pass them around between functions and only run them when necessary. This library also provides a number of useful control functions for chaining async actions with synchronous actions, handling error cases, and doing parallel operations. You can also use this library to wrap Promises to convert them to Futures as well as back into Promises. This allows you to integrate with existing APIs which only talk Promises.

## Installation

`npm install --save futurejs` or `yarn add futurejs`

## Types

This library is written in TypeScript and published to NPM as JavaScript. TypeScript types are provided as part of this repo, but you can also look at the source to get a better sense of how the functions are typed.

## API

### Constructor

`new Future<ResultType>((reject: (e: Error) => void, resolve: resolve: (result: ResultType) => void) => void)`

Futures are constructed by providing a function which will be invoked with two callbacks, `reject` and `resolve`. The function you provide to the constructor will not be run until you run the Future (explained later). Within this function you'll perform your async operation and invoke the `resolve` action with your data success or the `reject` action with an `Error` on failure.

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

### Promise Constructor

`new Future<ResultType>((reject: (e: Error) => void, resolve: (result: ResultType) => void) => Promise<ResultType>)`

Futures can also be constructed from functions that return Promises. In this case, the `reject` and `resolve` functions will automatically be provided as the callbacks to the Promise `.then` and `.reject` methods. This provides a great way to integrate into APIs which speak Promises. For example, wrapping async requests using the [fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) can be implemented like so:

```js
new Future(() => {
    return fetch('/some/api/request');
});
```

### engage

`engage(reject: (e: Error) => void, resolve: (result: ResultType) => void): void`

As mentioned earlier, Futures are lazy and won't evaluate your constructor action until you ask. This can be done via the `engage` function. Calling this function will start your Future chain. The `engage` method takes two function arguments which are the functions to execute on success or failure of the Future computation.

```js
const request = new Future(() => fetch('/some/api/request'));

request.engage(
    (error) => {/*handle Error scenario*/},
    (result) => {/*handle successful fetch response*/}
);
```

### toPromise

`toPromise(): Promise<ResultType>`

You can also convert your Future chain back into a Promise using the `toPromise` method. This function can be used as an alternative to the `engage` method as it will also kick off computation of your Future. 

```js
const request = new Future(() => fetch('/some/api/request'));

request
    .toPromise()
    .then(() => ...)
    .reject(() => ...)
```

### flatMap

`flatMap<T>(next: (data: ResultType) => Future<T>): Future<T>`

Run another asynchronous operation in sequence based on the prior Futures resolution value. This second operation will only be run if the first operation succeeded. This operation works similar to how you can chain Promises by returning a new Promise in the `then` callback.

```js
const request = new Future(() => fetch('/some/api/request'));

request.flatMap((fetchResult) => {
    return new Future(() => fech('/some/other/api/request'));
});
```

### map 

`map<T>(mapper: (data: ResultType) => T): Future<T>`

Run a synchronous operation that maps the prior Futures resolution value to a different value. This function is also useful if you need to decision off a prior resolution value to resolve or reject the Future.

```js
const request = new Future(() => fetch('/some/api/request'));

request.map((fetchResult) => {
    //Convert the resolution of this Future from the fetch() Response type to a boolean based on the status field
    return fetchResult.status === '204';
});
```

### errorMap

`errorMap(mapper: (error: Error) => Error): Future<ResultType>`

Map but for the reject case. Allows you to modify Error objects that might occur during the chain.

```js
const request = new Future(() => fetch('/some/api/request'));

request.errorMap((error) => {
    if(error.message.contains('no network')){
        return new Error('Please connect to a network before making requests.');
    }
    return error;
});
```

### handleWith

`handleWith<RepairedType extends ResultType>(errHandler: (e: Error) => Future<RepairedType>): Future<RepairedType>;`

Recover from an error in your Future chain and return a repaired result that can be passed to the rest of your chain. This allows you to possibly recover from an error if there are scenarios where error conditions shouldn't be propagated out from your computation. This method will not be invoked if the prior chain does not error, but it will be invoked if any of the prior chains failed, so placement of the `handleWith` call is important to avoid catch all situations. 

```js
const request = new Future(() => fetch('/some/api/request'));

request.handleWith((fetchError) => {
    //Convert the error case from the failed fetch() into something that can be handled in the rest of the chain
    return {requestFailed: true};
});
```

### of (static)

`Future.of<ResultType>(result: ResultType): Future<ResultType>;`

Creates a Future which will be immediately resolved with the provided value once computation is kicked off. This function is equivalent to `Promise.resolve()` except that it is still lazily evaluated.

```js
const fixed = new Future(() => fetch('/some/api/request'));

fixed.flatMap((result) => {
    return result.resolved;
});
```


### reject (static)

`reject<PhantomType>(error: Error): Future<PhantomType>;`

Creates a Future will will be immediately rejected with the provided Error once computation is kicked off. This function is equivalent to `Promise.reject()` except that it is still lazily evaluated.

```js
const fixed = new Future(() => fetch('/some/api/request'));

fixed.flatMap((result) => {
    if(result.status ===  '200'){
        return Future.of(true);
    }
    return Future.reject(new Error(result.status));
});
```

### gather2 (static)

`gather2<T1, T2>(future1: Future<T1>, future2: Future<T2>): Future<[T1, T2]>;`

Runs two Futures together in parallel which resolve in different result types. If either of the futures reject then the Future that this returns will reject as well. The resulting arrays values will be fixed by the parameter index. That is, the resolved value from the first Future will be in the 0 index of the array while the resolved value from the second Future will be in the 1 index of the array.

```js
const requests = Future.all(
    new Future(() => fetch('/api/request/one')),
    new Future(() => fetch('/api/request/two'));
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