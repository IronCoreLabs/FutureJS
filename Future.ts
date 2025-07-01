export type Resolve<R> = (result: R) => void;
export type Reject<L> = (e: L) => void;
export type RejectResolveAction<L, R> = (reject: Reject<L>, resolve: Resolve<R>) => void;

export default class Future<L, R> {
    action: RejectResolveAction<L, R>;
    constructor(action: RejectResolveAction<L, R>) {
        this.action = action;
    }

    /**
     * Start execution of the Future. Accepts resolve/reject parameters
     * @param {Function} reject  Handler if error occured during Future execution
     * @param {Function} resolve Handler if Future fully executed successfully
     */
    engage(reject: Reject<L>, resolve: Resolve<R>): void {
        this.action(reject, resolve);
    }

    private engageAndCatch(reject: Reject<L>, resolve: Resolve<R>, safe = true): void {
        if (safe) {
            try {
                this.engage(reject, resolve);
            } catch (e) {
                reject(e as L);
            }
        } else {
            this.engage(reject, resolve);
        }
    }

    /**
     * Presents a Thenable interface to the Future, which immediatly starts execution of the Future. This allows for
     * await syntax to be used on Futures, as well as chaining with other Thenable objects (e.g. Promises).
     * @param {Function} resolve Callback if Future fully executed successfully.
     * @param {Function} reject Callback if error occured during Future execution.
     * @returns {Promise<TResult1 | TResult2>} Promise that will resolve when the immediately executed Future is
     *                                         resolved, with resolve/reject applied to the result.
     */
    then<TResult1, TResult2>(
        resolve: (r: R) => TResult1 | PromiseLike<TResult1>,
        reject: (l: any) => TResult2 | PromiseLike<TResult2>
    ): Promise<TResult1 | TResult2> {
        return this.toPromise().then(resolve, reject);
    }

    /**
     * Similar to engage. Starts execution of the Future and returns the resolve/reject wrapped up in a Promise instead
     * of taking reject/resolve parameters.
     * @return {Promise<R>} Start execution of the Future but return a Promise which will be resolved/reject when the Future is
     */
    toPromise(): Promise<R> {
        return new Promise<R>((resolve: Resolve<R>, reject: Reject<L>) => this.engageAndCatch(reject, resolve));
    }

    /**
     * Modify the data within the pipeline synchronously
     * @param {Function} mapper Method which will receive the current data and map it to a new value
     */
    map<MapType>(mapper: (data: R) => MapType): Future<L, MapType> {
        return this.flatMap((x: R) => Future.of<MapType>(mapper(x)));
    }

    /**
     * Run another asynchronous operation recieving the data from the previous operation
     * @param {Function} next Method to execute to run the operation
     */
    flatMap<NewResultType>(next: (data: R) => Future<L, NewResultType>): Future<L, NewResultType> {
        return new Future<L, NewResultType>((reject: Reject<L>, resolve: Resolve<NewResultType>) => {
            this.engageAndCatch(reject, (data: R) => next(data).engageAndCatch(reject, resolve));
        });
    }

    /**
     * Attempt to recover from an error in the pipeline in order to continue without rejecting the Future. The repaired type must extend
     * the original R as to make sure follow-on Futures can handle the data further in the chain
     * @param {Function} errHandler Error handler which should return a new Future and resolve or reject result
     */
    handleWith<RepairedType extends R>(errHandler: (e: L) => Future<L, RepairedType>): Future<L, RepairedType> {
        return new Future<L, RepairedType>((reject: Reject<L>, resolve: Resolve<RepairedType>) => {
            this.engage((error) => {
                errHandler(error).engageAndCatch(reject, resolve, false);
            }, resolve as Resolve<R>);
        });
    }

    /**
     * Map errors to a new error type.
     * @param {Function} mapper Mapping function which will recieve the current error can map it to a new type
     */
    errorMap<LB>(mapper: (error: L) => LB): Future<LB, R> {
        return new Future<LB, R>((reject: Reject<LB>, resolve: Resolve<R>) => {
            this.engageAndCatch((error) => reject(mapper(error)), resolve);
        });
    }

    /**
     * Wrap the provided function in a Future which will either resolve with it's return value or reject with any exception it throws.
     * @param {Function} fn Function to invoke when Future is engaged
     */
    static tryF<LS extends Error, RS>(fn: () => RS): Future<LS, RS> {
        return new Future<LS, RS>((reject: Reject<LS>, resolve: Resolve<RS>) => {
            let result: RS;
            try {
                result = fn();
            } catch (e: any) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return reject(e);
            }
            resolve(result);
        });
    }

    /**
     * Wrap the provided function which returns a Promise within a Future. If the function either throws an error or the resulting Promise rejects, the Future will
     * also reject. Otherwise, the Future will resolve with the result of the resolved Promise.
     * @param {Function} fn Function to invoke which returns a Promise
     */
    static tryP<LS extends Error, RS>(fn: () => Promise<RS> | PromiseLike<RS>): Future<LS, RS> {
        return new Future<LS, RS>((reject: Reject<LS>, resolve: Resolve<RS>) => {
            let promiseResult: Promise<RS> | PromiseLike<RS>;
            try {
                promiseResult = fn();
            } catch (e: any) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return reject(e);
            }
            //We have to support both Promise and PromiseLike methods as input here, but treat them all as normal Promises when executing them
            (promiseResult as Promise<RS>).then(resolve).catch(reject);
        });
    }

    /**
     * Create a new synchronous Future which will automatically resolve with the provided value
     */
    static of<RS>(result: RS): Future<never, RS> {
        return new Future<never, RS>((_, resolve: Resolve<RS>) => {
            resolve(result);
        });
    }

    /**
     * Create a new synchronous Future which will automatically reject with the provided value
     */
    static reject<LS>(error: LS): Future<LS, never> {
        return new Future<LS, never>((reject: Reject<LS>) => {
            reject(error);
        });
    }

    /**
     * Takes a function and a value and creates a new Future which will attempt to run the function with the value
     * and reject if the method throws an exception.
     * @param {Function} fn The function to execute
     * @param {A}        a  The value to pass to the function
     */
    static encase<LS extends Error, RS, A>(fn: (a: A) => RS, a: A): Future<LS, RS> {
        return new Future<LS, RS>((reject: Reject<LS>, resolve: Resolve<RS>) => {
            let result: RS;
            try {
                result = fn(a);
            } catch (e: any) {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
                return reject(e);
            }
            resolve(result);
        });
    }

    /**
     * Returns a new Future which will run the two provided futures in "parallel". The returned Future will be resolved if both
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned and the Future is rejected.
     */
    static gather2<LS, R1, R2>(future1: Future<LS, R1>, future2: Future<LS, R2>): Future<LS, [R1, R2]> {
        return new Future((reject: Reject<LS>, resolve: Resolve<[R1, R2]>) => {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const results: [R1, R2] = [] as any;
            let count = 0;
            let done = false;

            future1.engageAndCatch(
                (error) => {
                    if (!done) {
                        done = true;
                        reject(error);
                    }
                },
                (result) => {
                    results[0] = result;
                    if (++count === 2) {
                        resolve(results);
                    }
                }
            );

            future2.engageAndCatch(
                (error) => {
                    if (!done) {
                        done = true;
                        reject(error);
                    }
                },
                (result) => {
                    results[1] = result;
                    if (++count === 2) {
                        resolve(results);
                    }
                }
            );
        });
    }

    /**
     * Same as gather2 except supports running three concurrent Futures
     */
    static gather3<LS, R1, R2, R3>(future1: Future<LS, R1>, future2: Future<LS, R2>, future3: Future<LS, R3>): Future<LS, [R1, R2, R3]> {
        const firstTwo = this.gather2(future1, future2);
        return this.gather2(firstTwo, future3).map<[R1, R2, R3]>(([[f1, f2], f3]) => [f1, f2, f3]);
    }

    /**
     * Same as gather2 except supports running four concurrent Futures
     */
    static gather4<LS, R1, R2, R3, R4>(
        future1: Future<LS, R1>,
        future2: Future<LS, R2>,
        future3: Future<LS, R3>,
        future4: Future<LS, R4>
    ): Future<LS, [R1, R2, R3, R4]> {
        const firstTwo = this.gather2(future1, future2);
        const secondTwo = this.gather2(future3, future4);
        return this.gather2(firstTwo, secondTwo).map<[R1, R2, R3, R4]>(([[f1, f2], [f3, f4]]) => [f1, f2, f3, f4]);
    }

    /**
     * Returns a new Future which will run all of the provided futures in parallel. The returned Future will be resolved if all of the Futures
     * resolve. If an array of Futures is provided the results will be in an array properly indexed to how they were provided. If an object of
     * Futures is provided the results will be an object with the same keys as the objected provided. If any of the Futures reject, then no results
     * are returned.
     */
    static all<LS, RS>(futures: Future<LS, RS>[]): Future<LS, RS[]>;
    static all<LS, RS>(futures: {[key: string]: Future<LS, RS>}): Future<LS, {[key: string]: RS}>;
    static all<LS, RS>(futures: Future<LS, RS>[] | {[key: string]: Future<LS, RS>}): Future<LS, RS[]> | Future<LS, {[key: string]: RS}> {
        return Array.isArray(futures) ? this.allArray(futures) : this.allObject(futures);
    }

    /**
     * Run all of the Futures in the provided array in parallel and resolve with an array where the results are in the same index
     * as the provided array.
     */
    private static allArray<LS, RS>(futures: Future<LS, RS>[]) {
        return new Future((reject: Reject<LS>, resolve: Resolve<RS[]>) => {
            const results: RS[] = [];
            let count = 0;

            if (futures.length === 0) {
                resolve(results);
            }

            futures.forEach((futureInstance, index) => {
                futureInstance.engageAndCatch(
                    (error) => {
                        reject(error);
                    },
                    (result) => {
                        results[index] = result;
                        count += 1;
                        if (count === futures.length) {
                            resolve(results);
                        }
                    }
                );
            });
        });
    }

    /**
     * Run all of the Futures in the provided Future map in parallel and resolve with an object where the results are in the same key
     * as the provided map.
     */
    private static allObject<LS, RS>(futures: {[key: string]: Future<LS, RS>}) {
        const futureKeys = Object.keys(futures);
        //Convert the Future map into an array in the same order as we get back from Object.keys
        const futuresArray = futureKeys.map((key) => futures[key]);
        return this.allArray(futuresArray).map((futureResults) => {
            //Now iterate over the original keys and build a new map from key to Future result
            return futureKeys.reduce((futureMap, futureKey, index) => {
                //The index of the object keys will be the same index as the expected result
                futureMap[futureKey] = futureResults[index];
                return futureMap;
            }, {} as {[key: string]: RS});
        });
    }
}
