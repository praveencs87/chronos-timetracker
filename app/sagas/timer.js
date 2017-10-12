import { call, take, fork, select, put, takeEvery, cancel } from 'redux-saga/effects';
import { eventChannel } from 'redux-saga';
import moment from 'moment';
import NanoTimer from 'nanotimer';
import { remote, ipcRenderer } from 'electron';
import {
  getUserData,
  getTimerTime,
  getTimerRunning,
  getScreenshotsSettings,
  getScreenshots,
  getScreenshotPeriods,
  getTimerIdleState,
  getSelectedIssueId,
  getTrackingIssueId,
  getWorklogComment,
  getLastScreenshotTime,
} from 'selectors';
import Raven from 'raven-js';
import { uiActions, timerActions, issuesActions, types } from 'actions';
import { idleTimeThreshold } from 'config';
import { randomPeriods } from 'timer-helper';

import { throwError } from './ui';
import { uploadWorklog } from './worklogs';
import { uploadScreenshot, rejectScreenshot, takeScreenshot } from './screenshots';

const system = remote.require('@paulcbetts/system-idle-time');

function* isScreenshotsAllowed() {
  try {
    const {
      screenshotsEnabled,
      screenshotsEnabledUsers,
    } = yield select(getScreenshotsSettings);
    const { key } = yield select(getUserData);
    const cond1 = screenshotsEnabled === 'everyone';
    const cond2 = screenshotsEnabled === 'forUsers' &&
      screenshotsEnabledUsers.includes(key);
    const cond3 = screenshotsEnabled === 'excludingUsers' &&
      !screenshotsEnabledUsers.includes(key);
    return cond1 || cond2 || cond3;
  } catch (err) {
    yield call(throwError, err);
    Raven.captureException(err);
    return false;
  }
}

function timerChannel() {
  const ticker = new NanoTimer();
  let secs = 0;
  return eventChannel((emitter) => {
    ticker.setInterval(() => {
      secs += 1;
      emitter(secs);
    }, '', '1s');
    return () => {
      ticker.clearInterval();
    };
  });
}

let prevIdleTime = 0;
let totalIdleTimeDuringOneMinute = 0;

function* idleCheck(secondsToMinutesGrid) {
  try {
    const idleTime = system.getIdleTime();
    const idleState = yield select(getTimerIdleState);
    const currentTime = yield select(getTimerTime);
    if (idleState && idleTime < idleTimeThreshold * 1000) {
      yield put(timerActions.setIdleState(false));
      remote.getGlobal('sharedObj').idleTime = prevIdleTime;
      remote.getGlobal('sharedObj').idleDetails =
        { from: currentTime - (Math.ceil(prevIdleTime / 1000)), to: currentTime };
      ipcRenderer.send('showIdlePopup');
    }
    if (!idleState && idleTime >= idleTimeThreshold * 1000) {
      yield put(timerActions.setIdleState(true));
    }
    if ((prevIdleTime >= 5 * 1000) && prevIdleTime > idleTime) {
      totalIdleTimeDuringOneMinute += prevIdleTime;
    }
    prevIdleTime = idleTime;
    if (currentTime % 60 === secondsToMinutesGrid) {
      yield put(timerActions.addIdleTime(totalIdleTimeDuringOneMinute));
      totalIdleTimeDuringOneMinute = 0;
    }
  } catch (err) {
    yield call(throwError, err);
    Raven.captureException(err);
  }
}

let nextPeriod;

function* screenshotsCheck() {
  try {
    const { screenshotsQuantity, screenshotsPeriod } = yield select(getScreenshotsSettings);
    const time = yield select(getTimerTime);
    const idleState = yield select(getTimerIdleState);
    let periods = yield select(getScreenshotPeriods);
    if (time === periods[0]) {
      if (!idleState) {
        yield fork(takeScreenshot);
        periods.shift();
        yield put(timerActions.setScreenshotPeriods(periods));
      }
    }
    if (time === nextPeriod) {
      nextPeriod += screenshotsPeriod;
      periods = randomPeriods(screenshotsQuantity, time, nextPeriod);
      yield put(timerActions.setScreenshotPeriods(periods));
    }
  } catch (err) {
    yield call(throwError, err);
    Raven.captureException(err);
  }
}

function setTimeToTray(time) {
  if (remote.getGlobal('sharedObj').trayShowTimer) {
    const humanFormat = new Date(time * 1000).toISOString().substr(11, 5);
    remote.getGlobal('tray').setTitle(humanFormat);
  }
}

function* timerStep(screenshotsAllowed, secondsToMinutesGrid) {
  try {
    yield put(timerActions.tick());
    yield call(idleCheck, secondsToMinutesGrid);
    if (screenshotsAllowed) {
      yield call(screenshotsCheck, nextPeriod);
    }
    const time = yield select(getTimerTime);
    yield call(setTimeToTray, time);
  } catch (err) {
    yield call(throwError, err);
    Raven.captureException(err);
  }
}


export function* runTimer(channel) {
  const { screenshotsPeriod } = yield select(getScreenshotsSettings);
  const screenshotsAllowed = yield call(isScreenshotsAllowed);
  const currentSeconds = moment().format('ss');
  const secondsToMinutesGrid = 60 - currentSeconds;
  // second remaining to end of current Idle-minute period
  const minutes = moment().format('mm');
  // 33
  const minutePeriod = screenshotsPeriod / 60;
  // 10
  const periodNumber = Math.floor(minutes / minutePeriod) + 1;
  const periodRange = (periodNumber * minutePeriod) - minutes;
  nextPeriod = (periodRange * 60) - currentSeconds;
  yield takeEvery(channel, timerStep, true, nextPeriod, secondsToMinutesGrid);
}

function* stopTimer(channel, timerInstance) {
  try {
    yield call(setTimeToTray, 0);
    channel.close();
    yield cancel(timerInstance);
    const trackingIssueId = yield select(getTrackingIssueId);
    const time = yield select(getTimerTime);
    const comment = yield select(getWorklogComment);
    const screenshots = yield select(getScreenshots);
    // TODO
    const screenshotsPeriod = 600;
    const worklogType = null;
    const activity = [];
    const keepedIdles = [];
    //
    yield put(timerActions.resetTimer());
    yield call(uploadWorklog, {
      issueId: trackingIssueId,
      timeSpentSeconds: time,
      comment,
      screenshotsPeriod,
      worklogType,
      screenshots,
      activity,
      keepedIdles,
    });
  } catch (err) {
    yield call(throwError, err);
    Raven.captureException(err);
  }
}

export function* timerFlow(): Generator<*, *, *> {
  try {
    const selectedIssueId = yield select(getSelectedIssueId);
    yield put(issuesActions.setTrackingIssue(selectedIssueId));
    yield call(ipcRenderer.send, 'startTimer');
    const channel = yield call(timerChannel);
    const timerInstance = yield fork(runTimer, channel);
    while (true) {
      yield take(types.STOP_TIMER_REQUEST);
      const time = yield select(getTimerTime);
      if (time < 60) {
        yield put(uiActions.setAlertModalOpen(true));
        const { type } = yield take([types.SET_ALERT_MODAL_OPEN, types.STOP_TIMER]);
        if (type === types.STOP_TIMER) {
          yield call(stopTimer, channel, timerInstance);
          yield cancel();
        }
      } else {
        yield call(stopTimer, channel, timerInstance);
        yield cancel();
      }
    }
  } catch (err) {
    yield call(throwError, err);
    Raven.captureException(err);
  }
}

export function* watchStartTimer() {
  yield takeEvery(types.START_TIMER, timerFlow);
}


export function* cutIddlesFromLastScreenshot() {
  const lastScreenshotTime = yield select(getLastScreenshotTime);
  const time = yield select(getTimerTime);
  const iddles = Math.ceil((time - lastScreenshotTime) / 60);
  /* TBD wtf is this yield put({
    type: types.CUT_IDDLES,
    payload: iddles,
  }); */
}

/* function forceSave() {
  const { getGlobal } = remote;
  const { running, uploading } = getGlobal('sharedObj');

  // eslint-disable-next-line no-alert
  if (running && window.confirm('Tracking in progress, save worklog before quit?')) {
    setForceQuitFlag();
    stopTimerRequest();
  }
  if (uploading) {
    // eslint-disable-next-line no-alert
    window.alert('Currently app in process of saving worklog, wait few seconds please');
  }
}

function dismissIdleTime() {
  const seconds = Math.ceil(time / 1000);
  cutIddles(Math.ceil(seconds / 60));
  _dismissIdleTime(seconds);
}

function keepIdleTime() {
  const { getGlobal } = remote;
  const { idleDetails } = getGlobal('sharedObj');
  saveKeepedIdle(idleDetails);
  normalizeScreenshotsPeriods();
} */

function createIpcChannel(listener, channel) {
  return eventChannel(emit => {
    const handler = (ev) => {
      emit({ ev, channel });
    };
    listener.on(channel, handler);
    // eventChannel must return unsubcribe function
    return () => {
      ipcRenderer.removeListener(channel, handler);
    };
  });
}

let acceptScreenshotChannel;
let rejectScreenshotChannel;

export function* watchAcceptScreenshot() {
  while (true) {
    yield take(acceptScreenshotChannel);
    const running = yield select(getTimerRunning);
    if (running) {
      const { getGlobal } = remote;
      const {
        screenshotTime,
        timestamp,
        lastScreenshotPath,
        lastScreenshotThumbPath,
      } = getGlobal('sharedObj');
      yield call(uploadScreenshot, {
        screenshotTime,
        lastScreenshotPath,
        lastScreenshotThumbPath,
        timestamp,
      });
    }
  }
}

export function* watchRejectScreenshot() {
  while (true) {
    yield take(rejectScreenshotChannel);
    const running = yield select(getTimerRunning);
    if (running) {
      const { getGlobal } = remote;
      const { lastScreenshotPath } = getGlobal('sharedObj');
      yield call(cutIddlesFromLastScreenshot);
      yield call(rejectScreenshot, lastScreenshotPath);
    }
  }
}

export function* createIpcListeners(): void {
  acceptScreenshotChannel = yield call(
    createIpcChannel,
    ipcRenderer,
    'screenshot-accept',
  );
  yield fork(watchAcceptScreenshot);
  rejectScreenshotChannel = yield call(
    createIpcChannel,
    ipcRenderer,
    'screenshot-reject',
  );
  yield fork(watchRejectScreenshot);

  // ipcRenderer.on('force-save', forceSave);
  // ipcRenderer.on('dismissIdleTime', dismissIdleTime);
  // ipcRenderer.on('keepIdleTime', keepIdleTime);
}
