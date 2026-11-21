import test from 'node:test';
import assert from 'node:assert/strict';
import {validateLeaveSubmission,nextUndecidedStep} from '../modules/attendance/leave-request-policy';
const valid={leaveTypeKey:'annual',startAt:'2026-11-21T07:00:00.000Z',endAt:'2026-11-21T15:00:00.000Z',requestedMinutes:480,reason:''};
test('accept valid leave request',()=>assert.equal(validateLeaveSubmission(valid,new Date('2026-11-19')).requestedMinutes,480));
test('reject reverse time range',()=>assert.throws(()=>validateLeaveSubmission({...valid,endAt:valid.startAt},new Date('2026-11-19'))));
test('reject negative minutes',()=>assert.throws(()=>validateLeaveSubmission({...valid,requestedMinutes:-10},new Date('2026-11-19'))));
test('reject invalid type',()=>assert.throws(()=>validateLeaveSubmission({...valid,leaveTypeKey:'../../'},new Date('2026-11-19'))));
test('select first undecided step in order',()=>assert.equal(nextUndecidedStep([{stepOrder:2,decision:null},{stepOrder:1,decision:'APPROVED'}])?.stepOrder,2));
