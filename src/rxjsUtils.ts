import { produce, Draft } from 'immer';
import { Observable, BehaviorSubject } from 'rxjs';
import { scan, tap, distinctUntilChanged } from 'rxjs/operators';

export type Reducer<T> = (stateDraft: Draft<T>, readOnlyState: T) => void;

export interface IStore<T> {
  state$: Observable<T>;
  dispatch: (reducer: Reducer<T>) => void;
}

export function createStore<T>(
  initialState: T,
  comparisonFn?: (x: T, y: T) => boolean,
): IStore<T> {
  const push$ = new BehaviorSubject<Reducer<T>>(state => state);

  // TODO: Middleware or at least have builtin support for array of reducers
  const state$ = push$.asObservable().pipe(
    // tap(reducer => console.debug('dispatch', reducer)),
    scan((state, reducer) => {
      // console.log('scan', state, reducer);
      return produce(state, stateDraft => reducer(stateDraft, state));
    }, initialState),
    distinctUntilChanged(comparisonFn),
    tap(state => console.debug('state', state)),
  );

  return { state$, dispatch: reducer => push$.next(reducer) };
}
