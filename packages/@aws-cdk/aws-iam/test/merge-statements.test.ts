import { App, Stack } from '@aws-cdk/core';
import * as iam from '../lib';

const PRINCIPAL_ARN1 = 'arn:aws:iam::111111111:user/user-name';
const principal1 = new iam.ArnPrincipal(PRINCIPAL_ARN1);

const PRINCIPAL_ARN2 = 'arn:aws:iam::111111111:role/role-name';
const principal2 = new iam.ArnPrincipal(PRINCIPAL_ARN2);

// Check that 'resource' statements are merged, and that 'notResource' statements are not,
// if the statements are otherwise the same.
test.each([
  ['resources', true],
  ['notResources', false],
] as Array<['resources' | 'notResources', boolean]>)
('merge %p statements: %p', (key, doMerge) => {
  assertMergedC(doMerge, [
    new iam.PolicyStatement({
      [key]: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      [key]: ['b'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: ['a', 'b'],
      Action: 'service:Action',
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
  ]);
});

// Check that 'action' statements are merged, and that 'notAction' statements are not,
// if the statements are otherwise the same.
test.each([
  ['actions', true],
  ['notActions', false],
] as Array<['actions' | 'notActions', boolean]>)
('merge %p statements: %p', (key, doMerge) => {
  assertMergedC(doMerge, [
    new iam.PolicyStatement({
      resources: ['a'],
      [key]: ['service:Action1'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['a'],
      [key]: ['service:Action2'],
      principals: [principal1],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: 'a',
      Action: ['service:Action1', 'service:Action2'],
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
  ]);
});

// Check that 'principal' statements are merged, and that 'notPrincipal' statements are not,
// if the statements are otherwise the same.
test.each([
  ['principals', true],
  ['notPrincipals', false],
] as Array<['principals' | 'notPrincipals', boolean]>)
('merge %p statements: %p', (key, doMerge) => {
  assertMergedC(doMerge, [
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      [key]: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      [key]: [principal2],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: 'a',
      Action: 'service:Action',
      Principal: { AWS: [PRINCIPAL_ARN1, PRINCIPAL_ARN2].sort() },
    },
  ]);
});

test('merge multiple types of principals', () => {
  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [new iam.ServicePrincipal('service.amazonaws.com')],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: 'a',
      Action: 'service:Action',
      Principal: {
        AWS: PRINCIPAL_ARN1,
        Service: 'service.amazonaws.com',
      },
    },
  ]);
});

test('multiple mergeable keys are not merged', () => {
  assertNoMerge([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action1'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['b'],
      actions: ['service:Action2'],
      principals: [principal1],
    }),
  ]);
});

test('can merge statements without principals', () => {
  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
    }),
    new iam.PolicyStatement({
      resources: ['b'],
      actions: ['service:Action'],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: ['a', 'b'],
      Action: 'service:Action',
    },
  ]);
});

test('if conditions are different, statements are not merged', () => {
  assertNoMerge([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
      conditions: {
        StringLike: {
          something: 'value',
        },
      },
    }),
    new iam.PolicyStatement({
      resources: ['b'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
  ]);
});

test('if conditions are the same, statements are merged', () => {
  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
      conditions: {
        StringLike: {
          something: 'value',
        },
      },
    }),
    new iam.PolicyStatement({
      resources: ['b'],
      actions: ['service:Action'],
      principals: [principal1],
      conditions: {
        StringLike: {
          something: 'value',
        },
      },
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: ['a', 'b'],
      Action: 'service:Action',
      Principal: { AWS: PRINCIPAL_ARN1 },
      Condition: {
        StringLike: {
          something: 'value',
        },
      },
    },
  ]);
});

test('also merge Deny statements', () => {
  assertMerged([
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      effect: iam.Effect.DENY,
      resources: ['b'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
  ], [
    {
      Effect: 'Deny',
      Resource: ['a', 'b'],
      Action: 'service:Action',
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
  ]);
});

test('merges 3 statements in multiple steps', () => {
  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['b'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    // This can combine with the previous two once they have been merged
    new iam.PolicyStatement({
      resources: ['a', 'b'],
      actions: ['service:Action2'],
      principals: [principal1],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: ['a', 'b'],
      Action: ['service:Action', 'service:Action2'],
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
  ]);
});

test('winnow down literal duplicates', () => {
  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['a', 'b'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: ['a', 'b'],
      Action: 'service:Action',
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
  ]);
});

test('winnow down literal duplicates if they are Refs', () => {
  const stack = new Stack();
  const user1 = new iam.User(stack, 'User1');
  const user2 = new iam.User(stack, 'User2');

  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [user1],
    }),
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [user1, user2],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: 'a',
      Action: 'service:Action',
      Principal: {
        AWS: [
          { 'Fn::GetAtt': ['User1E278A736', 'Arn'] },
          { 'Fn::GetAtt': ['User21F1486D1', 'Arn'] },
        ],
      },
    },
  ]);
});

test('merges 2 pairs separately', () => {
  // Merges pairs (0,2) and (1,3)
  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['c'],
      actions: ['service:Action1'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['b'],
      actions: ['service:Action'],
      principals: [principal1],
    }),
    new iam.PolicyStatement({
      resources: ['c'],
      actions: ['service:Action2'],
      principals: [principal1],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: ['a', 'b'],
      Action: 'service:Action',
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
    {
      Effect: 'Allow',
      Resource: 'c',
      Action: ['service:Action1', 'service:Action2'],
      Principal: { AWS: PRINCIPAL_ARN1 },
    },
  ]);
});

test('do not deep-merge info Refs and GetAtts', () => {
  const stack = new Stack();
  const user1 = new iam.User(stack, 'User1');
  const user2 = new iam.User(stack, 'User2');

  assertMerged([
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [user1],
    }),
    new iam.PolicyStatement({
      resources: ['a'],
      actions: ['service:Action'],
      principals: [user2],
    }),
  ], [
    {
      Effect: 'Allow',
      Resource: 'a',
      Action: 'service:Action',
      Principal: {
        AWS: [
          { 'Fn::GetAtt': ['User1E278A736', 'Arn'] },
          { 'Fn::GetAtt': ['User21F1486D1', 'Arn'] },
        ],
      },
    },
  ]);
});

function assertNoMerge(statements: iam.PolicyStatement[]) {
  const app = new App();
  const stack = new Stack(app, 'Stack');

  const regularResult = stack.resolve(new iam.PolicyDocument({ minimize: false, statements }));
  const minResult = stack.resolve(new iam.PolicyDocument({ minimize: true, statements }));

  expect(minResult).toEqual(regularResult);
}

function assertMerged(statements: iam.PolicyStatement[], expected: any[]) {
  const app = new App();
  const stack = new Stack(app, 'Stack');

  const minResult = stack.resolve(new iam.PolicyDocument({ minimize: true, statements }));

  expect(minResult.Statement).toEqual(expected);
}

/**
 * Assert Merged Conditional
 *
 * Based on a boolean, either call assertMerged or assertNoMerge. The 'expected'
 * argument only applies in the case where `doMerge` is true.
 */
function assertMergedC(doMerge: boolean, statements: iam.PolicyStatement[], expected: any[]) {
  return doMerge ? assertMerged(statements, expected) : assertNoMerge(statements);
}