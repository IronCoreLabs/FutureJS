export = Future;

declare namespace Future {
    export type Resolve<T> = (result: T) => void;
    export type Reject = (e: Error) => void;
    export type PromiseAction<T> = (reject: Reject, resolve: Resolve<T>) => Promise<T>;
    export type RejectResolveAction<T> = (reject: Reject, resolve: Resolve<T>) => void;
}

declare class Future<ResultType> {
    constructor(action: Future.PromiseAction<ResultType> | Future.RejectResolveAction<ResultType>);

    engage(reject: Future.Reject, resolve: Future.Resolve<ResultType>): void;

    toPromise(): Promise<ResultType>;

    map<MapType>(mapper: (data: ResultType) => MapType): Future<MapType>;

    flatMap<NewResultType>(next: (data: ResultType) => Future<NewResultType>): Future<NewResultType>;

    handleWith<RepairedType extends ResultType>(errHandler: (e: Error) => Future<RepairedType>): Future<RepairedType>;

    errorMap(mapper: (error: Error) => Error): Future<ResultType>;

    static of<ResultType>(result: ResultType): Future<ResultType>;

    static reject<PhantomType>(error: Error): Future<PhantomType>;

    static gather2<T1, T2>(future1: Future<T1>, future2: Future<T2>): Future<[T1, T2]>;

    static gather3<T1, T2, T3>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>): Future<[T1, T2, T3]>;

    static gather4<T1, T2, T3, T4>(future1: Future<T1>, future2: Future<T2>, future3: Future<T3>, future4: Future<T4>): Future<[T1, T2, T3, T4]>;

    static all<T>(futures: Array<Future<T>>): Future<T[]>;
}