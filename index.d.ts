export declare type Resolve<T> = (result: T) => void;
export declare type Reject = (e: Error) => void;
export declare type PromiseAction<T> = (reject: Reject, resolve: Resolve<T>) => Promise<T>;
export declare type RejectResolveAction<T> = (reject: Reject, resolve: Resolve<T>) => void;
export default class Future<ResultType> {
    action: PromiseAction<ResultType> | RejectResolveAction<ResultType>;
    constructor(action: PromiseAction<ResultType> | RejectResolveAction<ResultType>);
    /**
     * Start execution of the Future. Accepts resolve/reject parameters
     * @param {Function} reject  Handler if error occured during Future execution
     * @param {Function} resolve Handler if Future fully executed successfully
     */
    engage(reject: Reject, resolve: Resolve<ResultType>): void;
    /**
     * Similar to engage. Starts execution of the Future and returns the resolve/reject wrapped up in a Promise instead of taking reject/resolve parameters
     * @return {Promise<ResultType>} Start execution of the Future but return a Promise which will be resolved/reject when the Future is
     */
    toPromise(): Promise<ResultType>;
    /**
     * Modify the data within the pipeline synchronously
     * @param {Function} mapper Method which will receive the current data and map it to a new value
     */
    map<MapType>(mapper: (data: ResultType) => MapType): Future<MapType>;
    /**
     * Run another asynchronous operation recieving the data from the previous operation
     * @param {Function} next Method to execute to run the operation
     */
    flatMap<NewResultType>(next: (data: ResultType) => Future<NewResultType>): Future<NewResultType>;
    /**
     * Attempt to recover from an error in the pipeline in order to continue without rejecting the Future. The repaired type must extend
     * the original ResultType as to make sure follow-on Futures can handle the data further in the chain
     * @param {Function} errHandler Error handler which should return a new Future and resolve or reject result
     */
    handleWith<RepairedType extends ResultType>(errHandler: (e: Error) => Future<RepairedType>): Future<RepairedType>;
    /**
     * Map errors to a new error type.
     * @param {Function} mapper Mapping function which will recieve the current error can map it to a new type
     */
    errorMap(mapper: (error: Error) => Error): Future<ResultType>;
    /**
     * Create a new synchronous Future which will automatically resolve with the provided value
     */
    static of<ResultType>(result: ResultType): Future<ResultType>;
    /**
     * Create a new synchronous Future which will automatically reject with the provided value
     */
    static reject<PhantomType>(error: Error): Future<PhantomType>;
    /**
     * Returns a new Future which will run the two provided futures in "parallel". The returned Future will be resolved if both
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned and the Future is rejected.
     */
    static gather2<T1, T2>(future1: Future<T1>, future2: Future<T2>): Future<[T1, T2]>;
    /**
     * Same as gather2 except supports running three concurrent Futures
     */
    static gather3<T1, T2, T3>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>): Future<[T1, T2, T3]>;
    /**
     * Same as gather2 except supports running four concurrent Futures
     */
    static gather4<T1, T2, T3, T4>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>, future4: Future<T4>): Future<[T1, T2, T3, T4]>;
    /**
     * Returns a new Future which will run all of the provided futures in parallel. The returned Future will be resolved if all
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned
     */
    static all<T>(futures: Array<Future<T>>): Future<T[]>;
}
