export declare type Resolve<R> = (result: R) => void;
export declare type Reject<L> = (e: L) => void;
export declare type RejectResolveAction<L, R> = (reject: Reject<L>, resolve: Resolve<R>) => void;
export default class Future<L, R> {
    action: RejectResolveAction<L, R>;
    constructor(action: RejectResolveAction<L, R>);
    /**
     * Start execution of the Future. Accepts resolve/reject parameters
     * @param {Function} reject  Handler if error occured during Future execution
     * @param {Function} resolve Handler if Future fully executed successfully
     */
    engage(reject: Reject<L>, resolve: Resolve<R>): void;
    /**
     * Similar to engage. Starts execution of the Future and returns the resolve/reject wrapped up in a Promise instead of taking reject/resolve parameters
     * @return {Promise<R>} Start execution of the Future but return a Promise which will be resolved/reject when the Future is
     */
    toPromise(): Promise<R>;
    /**
     * Modify the data within the pipeline synchronously
     * @param {Function} mapper Method which will receive the current data and map it to a new value
     */
    map<MapType>(mapper: (data: R) => MapType): Future<L, MapType>;
    /**
     * Run another asynchronous operation recieving the data from the previous operation
     * @param {Function} next Method to execute to run the operation
     */
    flatMap<NewResultType>(next: (data: R) => Future<L, NewResultType>): Future<L, NewResultType>;
    /**
     * Attempt to recover from an error in the pipeline in order to continue without rejecting the Future. The repaired type must extend
     * the original R as to make sure follow-on Futures can handle the data further in the chain
     * @param {Function} errHandler Error handler which should return a new Future and resolve or reject result
     */
    handleWith<RepairedType extends R>(errHandler: (e: L) => Future<L, RepairedType>): Future<L, RepairedType>;
    /**
     * Map errors to a new error type.
     * @param {Function} mapper Mapping function which will recieve the current error can map it to a new type
     */
    errorMap<LB>(mapper: (error: L) => LB): Future<LB, R>;
    /**
     * Wrap the provided function in a Future which will either resolve with it's return value or reject with any exception it throws.
     * @param {Function} fn Function to invoke when Future is engaged
     */
    static tryF<L extends Error, R>(fn: () => R): Future<L, R>;
    /**
     * Wrap the provided function which returns a Promise within a Future. If the function either throws an error or the resulting Promise rejects, the Future will
     * also reject. Otherwise, the Future will resolve with the result of the resolved Promise.
     * @param {Function} fn Function to invoke which returns a Promise
     */
    static tryP<L extends Error, R>(fn: () => Promise<R> | PromiseLike<R>): Future<L, R>;
    /**
     * Create a new synchronous Future which will automatically resolve with the provided value
     */
    static of<R>(result: R): Future<never, R>;
    /**
     * Create a new synchronous Future which will automatically reject with the provided value
     */
    static reject<L>(error: L): Future<L, never>;
    /**
     * Takes a function and a value and creates a new Future which will attempt to run the function with the value
     * and reject if the method throws an exception.
     * @param {Function} fn The function to execute
     * @param {A}        a  The value to pass to the function
     */
    static encase<L extends Error, R, A>(fn: (a: A) => R, a: A): Future<L, R>;
    /**
     * Returns a new Future which will run the two provided futures in "parallel". The returned Future will be resolved if both
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned and the Future is rejected.
     */
    static gather2<L, R1, R2>(future1: Future<L, R1>, future2: Future<L, R2>): Future<L, [R1, R2]>;
    /**
     * Same as gather2 except supports running three concurrent Futures
     */
    static gather3<L, R1, R2, R3>(future1: Future<L, R1>, future2: Future<L, R2>, future3: Future<L, R3>): Future<L, [R1, R2, R3]>;
    /**
     * Same as gather2 except supports running four concurrent Futures
     */
    static gather4<L, R1, R2, R3, R4>(
        future1: Future<L, R1>,
        future2: Future<L, R2>,
        future3: Future<L, R3>,
        future4: Future<L, R4>
    ): Future<L, [R1, R2, R3, R4]>;
    /**
     * Returns a new Future which will run all of the provided futures in parallel. The returned Future will be resolved if all
     * of the futures resolve and the results will be in an array properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned
     */
    static all<L, R>(futures: Array<Future<L, R>>): Future<L, R[]>;
    /**
     * Returns a new Future which will run all of the provided futures in parallel. The returned Future will be resolved if all
     * of the futures resolve and the results will be in an object properly indexed to how they were passed in. If any of the Futures
     * reject, then no results are returned
     */
    static all<L, R>(futures: {[key: string]: Future<L, R>}): Future<L, {[key: string]: R}>;
}
