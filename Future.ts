export type Resolve<T> = (result: T) => void;
export type Reject = (e: Error) => void;
export type PromiseAction<T> = (reject: Reject, resolve: Resolve<T>) => Promise<T>;
export type RejectResolveAction<T> = (reject: Reject, resolve: Resolve<T>) => void;

export default class Future<ResultType> {
    action: PromiseAction<ResultType> | RejectResolveAction<ResultType>;
    constructor(action: PromiseAction<ResultType> | RejectResolveAction<ResultType>) {
        this.action = action;
    }

    /**
     * Start execution of the Future. Accepts resolve/reject parameters
     * @param {Function} reject  Handler if error occured during Future execution
     * @param {Function} resolve Handler if Future fully executed successfully
     */
    engage(reject: Reject, resolve: Resolve<ResultType>){
        let potentialPromise: Promise<ResultType>|void;
        try{
            //In the case where the action call just completely blows up, prevent against that and invoke reject.
            potentialPromise = this.action(reject, resolve);
        }
        catch(error){
            reject(error);
        }
        if(potentialPromise && typeof potentialPromise.then === 'function'){
            potentialPromise.then(resolve).catch(reject);
        }
    }

    /**
     * Similar to engage. Starts execution of the Future and returns the resolve/reject wrapped up in a Promise instead of taking reject/resolve parameters
     * @return {Promise<ResultType>} Start execution of the Future but return a Promise which will be resolved/reject when the Future is
     */
    toPromise(): Promise<ResultType>{
        return new Promise<ResultType>((resolve: Resolve<ResultType>, reject: Reject) => this.engage(reject, resolve));
    }

    /**
     * Modify the data within the pipeline synchronously
     * @param {Function} mapper Method which will receive the current data and map it to a new value
     */
    map<MapType>(mapper: (data: ResultType) => MapType): Future<MapType>{
        return this.flatMap((x: ResultType) => Future.of<MapType>(mapper(x)));
    }

    /**
     * Run another asynchronous operation recieving the data from the previous operation
     * @param {Function} next Method to execute to run the operation
     */
    flatMap<NewResultType>(next: (data: ResultType) => Future<NewResultType>){
        return new Future<NewResultType>((reject: Reject, resolve: Resolve<NewResultType>) => {
            this.engage(reject, (data: ResultType) => next(data).engage(reject, resolve));
        });
    }

    /**
     * Attempt to recover from an error in the pipeline in order to continue without rejecting the Future. The repaired type must extend
     * the original ResultType as to make sure follow-on Futures can handle the data further in the chain
     * @param {Function} errHandler Error handler which should return a new Future and resolve or reject result
     */
    handleWith<RepairedType extends ResultType>(errHandler: (e: Error) => Future<RepairedType>){
        return new Future<RepairedType>((reject: Reject, resolve: Resolve<RepairedType>) => {
            this.engage((error) => {
                errHandler(error).engage(reject, resolve);
            }, resolve as Resolve<ResultType>); //Type cast this as the resolved method should be able to handle both ResultType and RepairedType
        });
    }

    /**
     * Map errors to a new error type.
     * @param {Function} mapper Mapping function which will recieve the current error can map it to a new type
     */
    errorMap(mapper: (error: Error) => Error){
        return new Future<ResultType>((reject: Reject, resolve: Resolve<ResultType>) => {
            this.engage((error) => reject(mapper(error)), resolve);
        });
    }

    /**
     * Create a new synchronous Future which will automatically resolve with the provided value
     */
    static of<ResultType>(result: ResultType){
        return new Future<ResultType>((_, resolve: Resolve<ResultType>) => {
            resolve(result);
        });
    }

    /**
     * Create a new synchronous Future which will automatically reject with the provided value
     */
    static reject<PhantomType>(error: Error){
        return new Future<PhantomType>((reject: Reject) => {
            reject(error);
        });
    }

    /**
     * Returns a new Future which will run the two provided futures in "parallel". The returned Future will be resolved if both
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned and the Future is rejected.
     */
    static gather2<T1, T2>(future1: Future<T1>, future2: Future<T2>){
        return new Future((reject: Reject, resolve: Resolve<[T1, T2]>) => {
            const results: [T1, T2] = [] as any;
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
    static gather3<T1, T2, T3>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>){
        const firstTwo = this.gather2(future1, future2);
        return this.gather2(firstTwo, future3).map<[T1, T2, T3]>(([[f1, f2], f3]) => [f1, f2, f3]);
    }

    /**
     * Same as gather2 except supports running four concurrent Futures
     */
    static gather4<T1, T2, T3, T4>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>, future4: Future<T4>){
        const firstTwo = this.gather2(future1, future2);
        const secondTwo = this.gather2(future3, future4);
        return this.gather2(firstTwo, secondTwo).map<[T1, T2, T3, T4]>(([[f1, f2], [f3, f4]]) => [f1, f2, f3, f4]);
    }

    /**
     * Returns a new Future which will run all of the provided futures in parallel. The returned Future will be resolved if all
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned
     */
    static all<T>(futures: Array<Future<T>>){
        return new Future((reject: Reject, resolve: Resolve<T[]>) => {
            const results: T[] = [];
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
