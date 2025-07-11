import "jest-extended";
import Future from "./Future";

describe("Future", () => {
    /* eslint-disable @typescript-eslint/unbound-method */
    describe("engage", () => {
        test("runs action provided in constructor with reject/resolve callbacks", () => {
            const actionSpy = jasmine.createSpy("futureAction");
            const rejectSpy = jasmine.createSpy("rejectSpy");
            const resolveSpy = jasmine.createSpy("resolveSpy");

            new Future(actionSpy).engage(rejectSpy, resolveSpy);

            expect(actionSpy).toHaveBeenCalledWith(rejectSpy, resolveSpy);
            expect(rejectSpy).not.toHaveBeenCalled();
            expect(resolveSpy).not.toHaveBeenCalled();
        });

        test("does not invoke reject when action throws exception", () => {
            const actionSpy = jasmine.createSpy("futureAction").and.callFake(() => {
                throw new Error("forced error");
            });
            const rejectSpy = jasmine.createSpy("rejectSpy");
            const resolveSpy = jasmine.createSpy("resolveSpy");
            expect(() => {
                new Future(actionSpy).engage(rejectSpy, resolveSpy);
            }).toThrowError("forced error");
            expect(actionSpy).toHaveBeenCalledWith(rejectSpy, resolveSpy);
            expect(rejectSpy).not.toHaveBeenCalled();
            expect(resolveSpy).not.toHaveBeenCalled();
        });

        test("resolves with expected value on success", () => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };
            const rejectSpy = jasmine.createSpy("rejectSpy");
            const resolveSpy = jasmine.createSpy("resolveSpy");
            new Future(action).engage(rejectSpy, resolveSpy);

            expect(resolveSpy).toHaveBeenCalledWith("my value");
        });
        test("handleWith for current Future does not get run if errors above its scope throw", (done) => {
            let mapCalledTimes = 0;
            let handleWithCalledTimes = 0;
            const action = Future.of(33)
                .handleWith((e: Error) => {
                    // eslint-disable-next-line no-console
                    console.log(`failed an infallible future: ${e.message}`);
                    handleWithCalledTimes++;
                    return Future.of(-1);
                })
                .map((r) => {
                    mapCalledTimes++;
                    return r;
                });

            try {
                action.engage(
                    (e) => {
                        throw e;
                    },
                    (r) => {
                        throw new Error(`oh no, something went wrong after the future has run to completion on ${r}`);
                    }
                );
            } catch (e) {
                expect(handleWithCalledTimes).toBe(0);
                expect(mapCalledTimes).toBe(1);
                done();
            }
        });

        test("does not get run if engages above this scope throw in the rejection", (done) => {
            let mapCalledTimes = 0;
            let handleWithCalledTimes = 0;
            const expectedError = new Error("error message");
            let errorInHandleWith = null;
            const action: Future<Error, number> = Future.reject(expectedError)
                .handleWith((e): any => {
                    handleWithCalledTimes++;
                    errorInHandleWith = e;
                    return Future.of(-1);
                })
                .map((r) => {
                    mapCalledTimes++;
                    return r;
                });

            try {
                action.engage(
                    (e) => {
                        throw e;
                    },
                    (r) => {
                        throw new Error(`oh no, something went wrong after the future has run to completion on ${r}`);
                    }
                );
            } catch (e) {
                expect(handleWithCalledTimes).toBe(1);
                expect(errorInHandleWith).toBe(expectedError);
                expect(mapCalledTimes).toBe(1);
                done();
            }
        });
    });

    describe("toPromise", () => {
        test("returns a promise which can be chained with return value", () => {
            const actionSpy = jasmine.createSpy("futureAction");

            const prom = new Future(actionSpy).toPromise();

            expect(prom instanceof Promise).toBeTrue();
            expect(actionSpy).toHaveBeenCalledWith(jasmine.any(Function), jasmine.any(Function));
        });

        test("runs then result with value", (done) => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };

            new Future(action)
                .toPromise()
                .then((val: string) => {
                    expect(val).toEqual("my value");
                    done();
                })
                .catch(() => fail("shouldn't fail"));
        });

        test("catches error during exception", (done) => {
            const action = (reject: (err: Error) => void) => {
                reject(new Error("error value"));
            };

            new Future(action).toPromise().catch((val: Error) => {
                expect(val).toEqual(new Error("error value"));
                done();
            });
        });
    });

    describe("map", () => {
        test("converts value to new value", (done) => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };

            new Future<Error, string>(action)
                .map((val) => {
                    expect(val).toEqual("my value");
                    return "changed value";
                })
                .engage(
                    () => fail("engage reject callback should not have been invoked"),
                    (val) => {
                        expect(val).toEqual("changed value");
                        done();
                    }
                );
        });

        test("does not run map when first action fails", (done) => {
            const action = (reject: (err: Error) => void) => {
                reject(new Error("error value"));
            };

            new Future(action)
                .map(() => {
                    fail("map should not be called when action fails");
                })
                .engage(
                    (error) => {
                        expect(error).toEqual(new Error("error value"));
                        done();
                    },
                    () => fail("success callback should not be invoked on failure")
                );
        });
    });

    describe("flatMap", () => {
        test("maps futures together", (done) => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };

            new Future<Error, string>(action)
                .flatMap((val) => {
                    expect(val).toEqual("my value");
                    return new Future((_reject: (e: Error) => void, resolve: (val: string) => void) => {
                        resolve("my new future value");
                    });
                })
                .engage(
                    () => fail("Failure handler should not be invoked when handleWith succeeds"),
                    (val) => {
                        expect(val).toEqual("my new future value");
                        done();
                    }
                );
        });

        test("does not invoke flatMap when first action fails", (done) => {
            const action = (reject: (e: Error) => void) => {
                reject(new Error("error value"));
            };

            new Future(action)
                .flatMap(() => {
                    fail("flatMap should not be invoked if first action fails");
                    return Future.of("does not matter");
                })
                .engage(
                    (err) => {
                        expect(err).toEqual(new Error("error value"));
                        done();
                    },
                    () => fail("resolve handler should not be called when action failed")
                );
        });

        test("invokes reject handler if flatMap fails", (done) => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };

            new Future(action)
                .flatMap((val) => {
                    expect(val).toEqual("my value");
                    return new Future((reject: (e: Error) => void) => {
                        reject(new Error("flatMap error value"));
                    });
                })
                .engage(
                    (err) => {
                        expect(err).toEqual(new Error("flatMap error value"));
                        done();
                    },
                    () => fail("resolve handler should not be called when action failed")
                );
        });
    });

    describe("handleWith", () => {
        test("allows mapping of error to new result", (done) => {
            const action = (reject: (e: Error) => void) => {
                reject(new Error("failure content"));
            };

            new Future(action)
                .handleWith((err) => {
                    expect(err).toEqual(new Error("failure content"));
                    return new Future((_reject: (e: Error) => void, resolve: (val: string) => void) => {
                        resolve("my value");
                    });
                })
                .engage(
                    () => fail("Failure handler should not be invoked when handleWith succeeds"),
                    (val) => {
                        expect(val).toEqual("my value");
                        done();
                    }
                );
        });

        test("does not get run if action succeeds", (done) => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };

            new Future(action)
                .handleWith(() => {
                    fail("handleWith should not be called during success case");
                    return Future.of("does not matter");
                })
                .engage(
                    () => fail("reject handler shouldnt be invoked "),
                    (val) => {
                        expect(val).toEqual("my value");
                        done();
                    }
                );
        });
    });

    describe("errorMap", () => {
        test("converts error to new error value", (done) => {
            const action = (reject: (err: Error) => void) => {
                reject(new Error("error value"));
            };

            new Future<Error, string>(action)
                .errorMap((err) => {
                    expect(err).toEqual(new Error("error value"));
                    return new Error("mapped error");
                })
                .engage(
                    (err) => {
                        expect(err).toEqual(new Error("mapped error"));
                        done();
                    },
                    () => fail("resolve callback should not be invoked on error")
                );
        });

        test("does not get invoked when action succeeds", (done) => {
            const action = (_reject: (e: Error) => void, resolve: (val: string) => void) => {
                resolve("my value");
            };

            new Future<Error, string>(action)
                .errorMap((err) => {
                    expect(err).toEqual(new Error("error value"));
                    return new Error("mapped error");
                })
                .engage(
                    () => fail("engage reject callback should not have been invoked"),
                    (val) => {
                        expect(val).toEqual("my value");
                        done();
                    }
                );
        });
    });

    describe("tryF", () => {
        test("resolves with the return value of the provided function", () => {
            const fnToValue = jasmine.createSpy("fnToValue").and.returnValue("test");

            Future.tryF(fnToValue).engage(
                (e) => fail(e.message),
                (result) => {
                    expect(result).toEqual("test");
                    expect(fnToValue).toHaveBeenCalledWith();
                }
            );
        });

        test("rejects if the provided function throws an exception", () => {
            const fnToException = jasmine.createSpy("fnToPromise").and.throwError("forced failure");

            Future.tryF(fnToException).engage(
                (error) => {
                    expect(error.message).toEqual("forced failure");
                    expect(fnToException).toHaveBeenCalledWith();
                },
                () => fail("should reject when function throws an exception")
            );
        });
    });

    describe("tryP", () => {
        test("wraps returned promise in then/catch if returned", () => {
            const fauxCatch = jasmine.createSpy("fauxCatch");
            const fauxThen = jasmine.createSpy("fauxThen").and.returnValue({
                catch: fauxCatch,
            });
            const fauxPromise = jasmine.createSpy("fauxPromise").and.returnValue({
                then: fauxThen,
            });

            const rejectSpy = jasmine.createSpy("rejectSpy");
            const resolveSpy = jasmine.createSpy("resolveSpy");
            Future.tryP(fauxPromise).engage(rejectSpy, resolveSpy);

            expect(fauxPromise).toHaveBeenCalledWith();
            expect(fauxThen).toHaveBeenCalledWith(resolveSpy);
            expect(fauxCatch).toHaveBeenCalledWith(rejectSpy);
        });

        test("rejects if function that creates the promise throws an exception", () => {
            const fnToPromise = jasmine.createSpy("fnToPromise").and.throwError("forced failure");

            Future.tryP(fnToPromise).engage(
                (error) => {
                    expect(error.message).toEqual("forced failure");
                    expect(fnToPromise).toHaveBeenCalledWith();
                },
                () => fail("should reject when function throws an exception")
            );
        });
    });

    describe("of", () => {
        test("resolves Future with provided value", (done) => {
            Future.of("fixed value").engage(
                () => fail("reject handler should never be called when using Future.of"),
                (val) => {
                    expect(val).toEqual("fixed value");
                    done();
                }
            );
        });
    });

    describe("reject", () => {
        test("rejects Future with provided value", (done) => {
            Future.reject(new Error("fixed error")).engage(
                (err) => {
                    expect(err).toEqual(new Error("fixed error"));
                    done();
                },
                () => fail("resolve handler should never be called when using Future.reject")
            );
        });
    });

    describe("encase", () => {
        test("resolves with value of calling method", () => {
            const fn = jasmine.createSpy("fn").and.returnValue("test");
            const val = "provided value";

            Future.encase(fn, val).engage(
                (e) => fail(e),
                (value) => {
                    expect(value).toEqual("test");
                    expect(fn).toHaveBeenCalledWith("provided value");
                }
            );
        });

        test("rejects if function throws an exception", () => {
            const fn = jasmine.createSpy("fn").and.throwError("forced failure");
            const val = "provided value";

            Future.encase(fn, val).engage(
                (e) => {
                    expect(e.message).toEqual("forced failure");
                },
                () => fail("Should not resolve when method fails")
            );
        });
    });

    describe("gather2", () => {
        test("resolves both futures provided", () => {
            const f1 = Future.of("first future value");
            const f2 = Future.of("second future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.gather2(f1, f2).engage(
                (e) => fail(e),
                (val) => {
                    expect(val).toBeArrayOfSize(2);
                    expect(val[0]).toEqual("first future value");
                    expect(val[1]).toEqual("second future value");

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                }
            );
        });

        test("rejects with error when first future fails", () => {
            const f1 = Future.reject(new Error("first failed future"));
            const f2 = Future.of("second future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.gather2(f1, f2).engage(
                (err) => {
                    expect(err).toEqual(new Error("first failed future"));

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).not.toHaveBeenCalled();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("rejects with error when any subsequent future fails", () => {
            const f1 = Future.of("first future value");
            const f2 = Future.reject(new Error("second failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.gather2(f1, f2).engage(
                (err) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("rejects with first error that occured when multiple errors", (done) => {
            const f1 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => {
                    reject(new Error("first failure message"));
                });
            });
            const f2 = Future.reject(new Error("second failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.gather2(f1, f2).engage(
                (err) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    done();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("engages all futures without waiting", (done) => {
            const f1 = new Future((_, resolve) => {
                setTimeout(() => resolve("first future value"));
            });

            const f2 = Future.of("second future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.gather2(f1, f2).engage(
                (e) => fail(e),
                (val) => {
                    expect(val).toBeArrayOfSize(2);
                    expect(val[0]).toEqual("first future value");
                    expect(val[1]).toEqual("second future value");

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    done();
                }
            );
        });
    });

    describe("gather3", () => {
        test("resolves with array of values when all 3 Futures succeed", () => {
            const f1 = Future.of("first future value");
            const f2 = Future.of("second future value");
            const f3 = Future.of("third future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.gather3(f1, f2, f3).engage(
                (e) => fail(e),
                (val) => {
                    expect(val).toBeArrayOfSize(3);
                    expect(val[0]).toEqual("first future value");
                    expect(val[1]).toEqual("second future value");
                    expect(val[2]).toEqual("third future value");

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();
                }
            );
        });

        test("rejects with error when first future fails", () => {
            const f1 = Future.reject(new Error("first failed future"));
            const f2 = Future.of("second future value");
            const f3 = Future.of("third future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.gather3(f1, f2, f3).engage(
                (err) => {
                    expect(err).toEqual(new Error("first failed future"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).not.toHaveBeenCalled();
                    expect(f3.engage).not.toHaveBeenCalled();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("rejects with error when any subsequent future fails", () => {
            const f1 = Future.of("first future value");
            const f2 = Future.reject(new Error("second failure message"));
            const f3 = Future.of("third future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.gather3(f1, f2, f3).engage(
                (err) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).not.toHaveBeenCalled();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("rejects with first error that occured when multiple errors", (done) => {
            const f1 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => {
                    reject(new Error("first failure message"));
                });
            });
            const f2 = Future.of("second future result");
            const f3 = Future.reject(new Error("third failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.gather3(f1, f2, f3).engage(
                (err) => {
                    expect(err).toEqual(new Error("third failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();
                    done();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("engages all futures without waiting", (done) => {
            const f1 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => reject(new Error("first failure message")));
            });

            const f2 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => reject(new Error("second failure message")));
            });

            const f3 = Future.of("third future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.gather3(f1, f2, f3).engage(
                (err) => {
                    expect(err).toEqual(new Error("first failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();
                    done();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });
    });

    describe("gather4", () => {
        test("resolves with array of values when all 3 Futures succeed", () => {
            const f1 = Future.of("first future value");
            const f2 = Future.of("second future value");
            const f3 = Future.of("third future value");
            const f4 = Future.of("fourth future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();
            spyOn(f4, "engage").and.callThrough();

            Future.gather4(f1, f2, f3, f4).engage(
                (e) => fail(e),
                (val) => {
                    expect(val).toBeArrayOfSize(4);
                    expect(val[0]).toEqual("first future value");
                    expect(val[1]).toEqual("second future value");
                    expect(val[2]).toEqual("third future value");
                    expect(val[3]).toEqual("fourth future value");

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();
                    expect(f4.engage).toHaveBeenCalled();
                }
            );
        });

        test("rejects with error when any subsequent future fails", () => {
            const f1 = Future.of("first future value");
            const f2 = Future.reject(new Error("second failure message"));
            const f3 = Future.of("third future value");
            const f4 = Future.reject(new Error("fourth failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();
            spyOn(f4, "engage").and.callThrough();

            Future.gather4(f1, f2, f3, f4).engage(
                (err) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).not.toHaveBeenCalled();
                    expect(f4.engage).not.toHaveBeenCalled();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });

        test("engages all futures without waiting", (done) => {
            const f1 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => reject(new Error("first failure message")));
            });

            const f2 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => reject(new Error("second failure message")));
            });

            const f3 = Future.of("third future value");
            const f4 = Future.of("fourth future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();
            spyOn(f4, "engage").and.callThrough();

            Future.gather4(f1, f2, f3, f4).engage(
                (err) => {
                    expect(err).toEqual(new Error("first failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();
                    expect(f4.engage).toHaveBeenCalled();
                    done();
                },
                () => fail("resolve callback should not be invoked when any of the futures fail")
            );
        });
    });

    describe("all", () => {
        test("resolves with array of values when all Futures succeed", (done) => {
            const f1 = Future.of("first future value");
            const f2 = Future.of("second future value");
            const f3 = Future.of("third future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.all([f1, f2, f3]).engage(
                () => {
                    fail("reject handler should not be invoked when all futures resolve");
                },
                (val: string[]) => {
                    expect(val).toBeArrayOfSize(3);
                    expect(val[0]).toEqual("first future value");
                    expect(val[1]).toEqual("second future value");
                    expect(val[2]).toEqual("third future value");

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();

                    done();
                }
            );
        });

        test("rejects with error when first future fails", (done) => {
            const f1 = Future.reject(new Error("first failed future"));
            const f2 = Future.of("second future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.all([f1, f2]).engage(
                (err: Error) => {
                    expect(err).toEqual(new Error("first failed future"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).not.toHaveBeenCalled();
                    done();
                },
                () => {
                    fail("resolve callback should not be invoked when any of the futures fail");
                }
            );
        });

        test("rejects with error when any subsequent future fails", (done) => {
            const f1 = Future.of("first future value");
            const f2 = Future.reject(new Error("second failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.all([f1, f2]).engage(
                (err: Error) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    done();
                },
                () => {
                    fail("resolve callback should not be invoked when any of the futures fail");
                }
            );
        });

        test("rejects with first error that occured when multiple errors", (done) => {
            const f1 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => {
                    reject(new Error("first failure message"));
                });
            });
            const f2 = Future.reject(new Error("second failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.all([f1, f2]).engage(
                (err: Error) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    done();
                },
                () => {
                    fail("resolve callback should not be invoked when any of the futures fail");
                }
            );
        });

        test("resolves immediately if the array is empty.", (done) => {
            Future.all([]).engage(
                () => {
                    fail("an empty array of futures shouldn't fail");
                },
                (arr) => {
                    expect(arr).toEqual([]);
                    done();
                }
            );
        });
    });

    describe("allObject", () => {
        test("resolves with object with expected keys", (done) => {
            const f1 = Future.of("first future value");
            const f2 = Future.of("second future value");
            const f3 = Future.of("third future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();
            spyOn(f3, "engage").and.callThrough();

            Future.all({f1, f2, f3}).engage(
                () => {
                    fail("reject handler should not be invoked when all futures resolve");
                },
                (result) => {
                    expect(Object.keys(result)).toBeArrayOfSize(3);
                    expect(result.f1).toEqual("first future value");
                    expect(result.f2).toEqual("second future value");
                    expect(result.f3).toEqual("third future value");

                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    expect(f3.engage).toHaveBeenCalled();

                    done();
                }
            );
        });

        test("rejects with error when first future fails", (done) => {
            const f1 = Future.reject(new Error("first failed future"));
            const f2 = Future.of("second future value");

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.all({f1, f2}).engage(
                (err: Error) => {
                    expect(err).toEqual(new Error("first failed future"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).not.toHaveBeenCalled();
                    done();
                },
                () => {
                    fail("resolve callback should not be invoked when any of the futures fail");
                }
            );
        });

        test("rejects with error when any subsequent future fails", (done) => {
            const f1 = Future.of("first future value");
            const f2 = Future.reject(new Error("second failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.all({f1, f2}).engage(
                (err: Error) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    done();
                },
                () => {
                    fail("resolve callback should not be invoked when any of the futures fail");
                }
            );
        });

        test("rejects with first error that occured when multiple errors", (done) => {
            const f1 = new Future((reject: (err: Error) => void) => {
                setTimeout(() => {
                    reject(new Error("first failure message"));
                });
            });
            const f2 = Future.reject(new Error("second failure message"));

            spyOn(f1, "engage").and.callThrough();
            spyOn(f2, "engage").and.callThrough();

            Future.all({f1, f2}).engage(
                (err: Error) => {
                    expect(err).toEqual(new Error("second failure message"));
                    expect(f1.engage).toHaveBeenCalled();
                    expect(f2.engage).toHaveBeenCalled();
                    done();
                },
                () => {
                    fail("resolve callback should not be invoked when any of the futures fail");
                }
            );
        });

        test("resolves immediately if the object is empty.", (done) => {
            Future.all({}).engage(
                () => {
                    fail("an empty object of futures shouldn't fail");
                },
                (obj) => {
                    expect(obj).toEqual({});
                    done();
                }
            );
        });
    });

    describe("then-able", () => {
        test("works with await syntax.", async () => {
            const f = Future.of(1);
            const result = await f;
            expect(result).toEqual(1);
        });

        test("blows up correctly with await syntax.", async () => {
            const f = Future.reject(new Error("bad stuff"));

            await expect(f).rejects.toThrow("bad stuff");
        });

        test("can be chained with normal promises.", async () => {
            const p = Promise.resolve(1);
            const result = await p.then((num) => Future.of(num + 1));
            expect(result).toEqual(2);
        });

        test("blows up correctly when chained with normal promises.", async () => {
            const p = Promise.resolve(1);
            const chainedPromiseFuture = p.then(() => Future.reject(new Error("bad stuff")));

            await expect(chainedPromiseFuture).rejects.toThrow("bad stuff");
        });

        test("catches exceptions if thrown in the map of the future", async () => {
            const p = Promise.resolve(1);
            const chainedPromiseFuture = p.then(() =>
                Future.of(1).map(() => {
                    throw new Error("bad stuff");
                })
            );

            await expect(chainedPromiseFuture).rejects.toThrow("bad stuff");
        });
    });
});
