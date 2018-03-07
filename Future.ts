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
    engage(reject: Reject<L>, resolve: Resolve<R>){
        try{
            //In the case where the action call just completely blows up, prevent against that and invoke reject.
            this.action(reject, resolve);
        }
        catch(error){
            reject(error);
        }
    }

    /**
     * Similar to engage. Starts execution of the Future and returns the resolve/reject wrapped up in a Promise instead of taking reject/resolve parameters
     * @return {Promise<R>} Start execution of the Future but return a Promise which will be resolved/reject when the Future is
     */
    toPromise(): Promise<R>{
        return new Promise<R>((resolve: Resolve<R>, reject: Reject<L>) => this.engage(reject, resolve));
    }

    /**
     * Modify the data within the pipeline synchronously
     * @param {Function} mapper Method which will receive the current data and map it to a new value
     */
    map<MapType>(mapper: (data: R) => MapType): Future<L, MapType>{
        return this.flatMap((x: R) => Future.of<MapType>(mapper(x)));
    }

    /**
     * Run another asynchronous operation recieving the data from the previous operation
     * @param {Function} next Method to execute to run the operation
     */
    flatMap<NewResultType>(next: (data: R) => Future<L, NewResultType>){
        return new Future<L, NewResultType>((reject: Reject<L>, resolve: Resolve<NewResultType>) => {
            this.engage(reject, (data: R) => next(data).engage(reject, resolve));
        });
    }

    /**
     * Attempt to recover from an error in the pipeline in order to continue without rejecting the Future. The repaired type must extend
     * the original R as to make sure follow-on Futures can handle the data further in the chain
     * @param {Function} errHandler Error handler which should return a new Future and resolve or reject result
     */
    handleWith<RepairedType extends R>(errHandler: (e: L) => Future<L, RepairedType>){
        return new Future<L, RepairedType>((reject: Reject<L>, resolve: Resolve<RepairedType>) => {
            this.engage((error) => {
                errHandler(error).engage(reject, resolve);
            }, resolve as Resolve<R>); //Type cast this as the resolved method should be able to handle both R and RepairedType
        });
    }

    /**
     * Map errors to a new error type.
     * @param {Function} mapper Mapping function which will recieve the current error can map it to a new type
     */
    errorMap<LB>(mapper: (error: L) => LB){
        return new Future<LB, R>((reject: Reject<LB>, resolve: Resolve<R>) => {
            this.engage((error) => reject(mapper(error)), resolve);
        });
    }

    /**
     * Wrap the provided function in a Future which will either resolve with it's return value or reject with any exception it throws.
     * @param {Function} fn Function to invoke when Future is engaged
     */
    static tryF<L extends Error, R>(fn: () => R){
        return new Future<L, R>((reject: Reject<L>, resolve: Resolve<R>) => {
            let result: R;
            try{
                result = fn();
            }
            catch(e){
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
    static tryP<L extends Error, R>(fn: () => Promise<R>|PromiseLike<R>){
        return new Future<L, R>((reject: Reject<L>, resolve: Resolve<R>) => {
            let promiseResult: Promise<R>|PromiseLike<R>;
            try{
                promiseResult = fn();
            }
            catch(e){
                return reject(e);
            }
            //We have to support both Promise and PromiseLike methods as input here, but treat them all as normal Promises when executing them
            (promiseResult as Promise<R>).then(resolve, reject)
        });
    }

    /**
     * Create a new synchronous Future which will automatically resolve with the provided value
     */
    static of<R>(result: R){
        return new Future<never, R>((_, resolve: Resolve<R>) => {
            resolve(result);
        });
    }

    /**
     * Create a new synchronous Future which will automatically reject with the provided value
     */
    static reject<L>(error: L){
        return new Future<L, never>((reject: Reject<L>) => {
            reject(error);
        });
    }

    /**
     * Takes a function and a value and creates a new Future which will attempt to run the function with the value
     * and reject if the method throws an exception.
     * @param {Function} fn The function to execute
     * @param {A}        a  The value to pass to the function
     */
    static encase<L extends Error, R, A>(fn: (a: A) => R, a: A){
        return new Future<L, R>((reject: Reject<L>, resolve: Resolve<R>) => {
            let result: R;
            try{
                result = fn(a);
            }
            catch(e){
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
    static gather2<L, R1, R2>(future1: Future<L, R1>, future2: Future<L, R2>){
        return new Future((reject: Reject<L>, resolve: Resolve<[R1, R2]>) => {
            const results: [R1, R2] = [] as any;
            let count = 0;
            let done = false;

            future1.engage(
                (error) => {
                    if(!done) {
                        done = true;
                        reject(error);
                    }
                },
                (result) => {
                    results[0] = result;
                    if(++count === 2) {
                        resolve(results);
                    }
                }
            );

            future2.engage(
                (error) => {
                    if(!done) {
                        done = true;
                        reject(error);
                    }
                },
                (result) => {
                    results[1] = result;
                    if(++count === 2) {
                        resolve(results);
                    }
                }
            );
        });
    }

    /**
     * Same as gather2 except supports running three concurrent Futures
     */
    static gather3<L, R1, R2, R3>(future1: Future<L, R1>, future2: Future<L, R2>, future3: Future<L, R3>){
        const firstTwo = this.gather2(future1, future2);
        return this.gather2(firstTwo, future3).map<[R1, R2, R3]>(([[f1, f2], f3]) => [f1, f2, f3]);
    }

    /**
     * Same as gather2 except supports running four concurrent Futures
     */
    static gather4<L, R1, R2, R3, R4>(future1: Future<L, R1>, future2: Future<L, R2>, future3: Future<L, R3>, future4: Future<L, R4>){
        const firstTwo = this.gather2(future1, future2);
        const secondTwo = this.gather2(future3, future4);
        return this.gather2(firstTwo, secondTwo).map<[R1, R2, R3, R4]>(([[f1, f2], [f3, f4]]) => [f1, f2, f3, f4]);
    }

    /**
     * Returns a new Future which will run all of the provided futures in parallel. The returned Future will be resolved if all
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned
     */
    static all<L, R>(futures: Array<Future<L, R>>){
        return new Future((reject: Reject<L>, resolve: Resolve<R[]>) => {
            const results: R[] = [];
            let count = 0;
            let done = false;

            futures.forEach((futureInstance, index) => {
                futureInstance.engage(
                    (error) => {
                        if(!done) {
                            done = true;
                            reject(error);
                        }
                    },
                    (result) => {
                        results[index] = result;
                        count += 1;
                        if(count === futures.length) {
                            resolve(results);
                        }
                    }
                );
            });
        });
    }
}
