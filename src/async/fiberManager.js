var Fiber = require('../fibers');
/** Helpers for Fiber management. */
var FiberManager;
(function (FiberManager) {
    /** Returns true if the current execution context is within a fiber. */
    function isExecutingInFiber() {
        return !!Fiber.current;
    }
    FiberManager.isExecutingInFiber = isExecutingInFiber;
    /** Creates and returns a new fiber in which an arbitrary function may be executed. */
    function create() {
        return Fiber(runInFiber);
    }
    FiberManager.create = create;
})(FiberManager || (FiberManager = {}));
/**
 * The runInFiber() function provides the prolog/epilog wrapper code for running a function inside
 * a fiber. The runInFiber() function accepts a RunContext instance, and calls the wrapped function
 * specified there. The final return/throw value of the wrapped function is used to notify the
 * promise resolver and/or callback specified in the RunContext. This function must take all its
 * information in a single argument because it is called via Fiber#run(), which accepts one argument.
 * NB: Since try/catch/finally prevents V8 optimisations, the function is split into several parts.
 */
function runInFiber(runCtx) {
    try {
        tryBlock(runCtx);
    }
    catch (err) {
        catchBlock(runCtx, err);
    }
    finally {
        finallyBlock(runCtx);
    }
}
function tryBlock(runCtx) {
    // Maintain an accurate count of currently active fibers, for pool management.
    adjustFiberCount(+1);
    // Call the wrapped function. It may be suspended several times (at await and/or yield calls).
    var result = runCtx.wrapped.apply(runCtx.thisArg, runCtx.argsAsArray);
    // The wrapped function returned normally. Notify any waiters.
    if (runCtx.callback)
        runCtx.callback(null, result);
    if (runCtx.resolver)
        runCtx.resolver.resolve(result);
}
function catchBlock(runCtx, err) {
    // The wrapped function threw an exception. Notify any waiters.
    if (runCtx.callback)
        runCtx.callback(err);
    if (runCtx.resolver)
        runCtx.resolver.reject(err);
}
function finallyBlock(runCtx) {
    // Maintain an accurate count of currently active fibers, for pool management.
    adjustFiberCount(-1);
    // Execute the done() callback, if provided.
    if (runCtx.done)
        runCtx.done();
}
/**
 * The following functionality prevents memory leaks in node-fibers by actively managing Fiber.poolSize.
 * For more information, see https://github.com/laverdet/node-fibers/issues/169.
 */
function adjustFiberCount(delta) {
    activeFiberCount += delta;
    if (activeFiberCount >= fiberPoolSize) {
        fiberPoolSize += 100;
        Fiber.poolSize = fiberPoolSize;
    }
}
var fiberPoolSize = Fiber.poolSize;
var activeFiberCount = 0;
module.exports = FiberManager;
