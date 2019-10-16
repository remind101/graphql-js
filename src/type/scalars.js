// @flow strict

/*
  NOTE: This copy of `scalars.js` includes a partial reversion of the following backwardly
  incompatible changes:

    1. <https://github.com/graphql/graphql-js/pull/1336/files>
    2. <https://github.com/graphql/graphql-js/pull/1382/files>
*/

import isFinite from '../polyfills/isFinite';
import isInteger from '../polyfills/isInteger';

import inspect from '../jsutils/inspect';
import isObjectLike from '../jsutils/isObjectLike';

import { Kind } from '../language/kinds';

import { GraphQLScalarType, isScalarType } from './definition';

// As per the GraphQL Spec, Integers are only treated as valid when a valid
// 32-bit signed integer, providing the broadest support across platforms.
//
// n.b. JavaScript's integers are safe between -(2^53 - 1) and 2^53 - 1 because
// they are internally represented as IEEE 754 doubles.
const MAX_INT = 2147483647;
const MIN_INT = -2147483648;

const green = '\x1B[32m';
const yellow = '\x1B[33m';
const white = '\x1B[37m';
const warn = (error: string, msg: string) => {
  // eslint-disable-next-line no-console
  console.warn(`${error}: ${msg}`);

  if (process.env.NODE_ENV === 'development') {
    setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(`
${yellow}${error}${white}:
  ${msg}
  ⬆️  Find inline error message in preceding logs for more context.
  Please fix in a ${green}backwardly compatible${white} way; deprecate the incompatible field and provide a compatible replacement field.
`);
    }, 30000);
  }
};
const warnInputCoercion = (msg: string) =>
  warn('Type coercion of client input variables is deprecated', msg);
const warnResultCoercion = (msg: string) =>
  warn('Type coercion of server serialized output has become more strict', msg);

function serializeInt(value: mixed): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  let num = value;
  if (typeof value === 'string' && value !== '') {
    num = Number(value);
  }

  if (!isInteger(num)) {
    throw new TypeError(
      `Int cannot represent non-integer value: ${inspect(value)}`,
    );
  }
  if (num > MAX_INT || num < MIN_INT) {
    throw new TypeError(
      `Int cannot represent non 32-bit signed integer value: ${inspect(value)}`,
    );
  }
  return num;
}

function coerceInt(value: mixed): number {
  if (!isInteger(value)) {
    warnInputCoercion(
      `Int cannot represent non-integer value: ${inspect(value)}`,
    );
    return serializeInt(value);
  }
  if (value > MAX_INT || value < MIN_INT) {
    throw new TypeError(
      `Int cannot represent non 32-bit signed integer value: ${inspect(value)}`,
    );
  }
  return value;
}

export const GraphQLInt = new GraphQLScalarType({
  name: 'Int',
  description:
    'The `Int` scalar type represents non-fractional signed whole numeric values. Int can represent values between -(2^31) and 2^31 - 1.',
  serialize: serializeInt,
  parseValue: coerceInt,
  parseLiteral(ast) {
    if (ast.kind === Kind.INT) {
      const num = parseInt(ast.value, 10);
      if (num <= MAX_INT && num >= MIN_INT) {
        return num;
      }
    }
    return undefined;
  },
});

function serializeFloat(value: mixed): number {
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }

  let num = value;
  if (typeof value === 'string' && value !== '') {
    num = Number(value);
  }
  if (!isFinite(num)) {
    throw new TypeError(
      `Float cannot represent non numeric value: ${inspect(value)}`,
    );
  }
  return num;
}

function coerceFloat(value: mixed): number {
  if (!isFinite(value)) {
    warnInputCoercion(
      `Float cannot represent non numeric value: ${inspect(value)}`,
    );
    return serializeFloat(value);
  }
  return value;
}

export const GraphQLFloat = new GraphQLScalarType({
  name: 'Float',
  description:
    'The `Float` scalar type represents signed double-precision fractional values as specified by [IEEE 754](https://en.wikipedia.org/wiki/IEEE_floating_point).',
  serialize: serializeFloat,
  parseValue: coerceFloat,
  parseLiteral(ast) {
    return ast.kind === Kind.FLOAT || ast.kind === Kind.INT
      ? parseFloat(ast.value)
      : undefined;
  },
});

// Support serializing objects with custom valueOf() or toJSON() functions -
// a common way to represent a complex value which can be represented as
// a string (ex: MongoDB id objects).
function serializeObject(value: mixed): mixed {
  if (isObjectLike(value)) {
    if (typeof value.valueOf === 'function') {
      const valueOfResult = value.valueOf();
      if (!isObjectLike(valueOfResult)) {
        return valueOfResult;
      }
    }
    if (typeof value.toJSON === 'function') {
      // $FlowFixMe(>=0.90.0)
      return value.toJSON();
    }
  }
  return value;
}

function serializeString(rawValue: mixed): string {
  const value = serializeObject(rawValue);

  // Serialize string, boolean and number values to a string, but do not
  // attempt to coerce object, function, symbol, or other types as strings.
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (isFinite(value)) {
    return value.toString();
  }
  throw new TypeError(`String cannot represent value: ${inspect(rawValue)}`);
}

function coerceString(value: mixed): string {
  if (typeof value !== 'string') {
    warnInputCoercion(
      `String cannot represent a non string value: ${inspect(value)}`,
    );
    return serializeString(value);
  }
  return value;
}

export const GraphQLString = new GraphQLScalarType({
  name: 'String',
  description:
    'The `String` scalar type represents textual data, represented as UTF-8 character sequences. The String type is most often used by GraphQL to represent free-form human-readable text.',
  serialize: serializeString,
  parseValue: coerceString,
  parseLiteral(ast) {
    return ast.kind === Kind.STRING ? ast.value : undefined;
  },
});

function serializeBoolean(value: mixed): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  if (isFinite(value)) {
    return value !== 0;
  }

  warnResultCoercion(
    `Boolean cannot represent a non boolean value: ${inspect(value)}`,
  );
  return Boolean(value);
}

function coerceBoolean(value: mixed): boolean {
  if (typeof value !== 'boolean') {
    warnInputCoercion(
      `Boolean cannot represent a non boolean value: ${inspect(value)}`,
    );
    return serializeBoolean(value);
  }
  return value;
}

export const GraphQLBoolean = new GraphQLScalarType({
  name: 'Boolean',
  description: 'The `Boolean` scalar type represents `true` or `false`.',
  serialize: serializeBoolean,
  parseValue: coerceBoolean,
  parseLiteral(ast) {
    return ast.kind === Kind.BOOLEAN ? ast.value : undefined;
  },
});

function serializeID(rawValue: mixed): string {
  const value = serializeObject(rawValue);

  if (typeof value === 'string') {
    return value;
  }
  if (isInteger(value)) {
    return String(value);
  }

  warnResultCoercion(`ID cannot represent value: ${inspect(rawValue)}`);
  return String(rawValue);
}

function coerceID(value: mixed): string {
  if (typeof value === 'string') {
    return value;
  }
  if (isInteger(value)) {
    return value.toString();
  }
  warnInputCoercion(`ID cannot represent value: ${inspect(value)}`);
  return serializeString(value);
}

export const GraphQLID = new GraphQLScalarType({
  name: 'ID',
  description:
    'The `ID` scalar type represents a unique identifier, often used to refetch an object or as key for a cache. The ID type appears in a JSON response as a String; however, it is not intended to be human-readable. When expected as an input type, any string (such as `"4"`) or integer (such as `4`) input value will be accepted as an ID.',
  serialize: serializeID,
  parseValue: coerceID,
  parseLiteral(ast) {
    return ast.kind === Kind.STRING || ast.kind === Kind.INT
      ? ast.value
      : undefined;
  },
});

export const specifiedScalarTypes = Object.freeze([
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLID,
]);

export function isSpecifiedScalarType(type: mixed): boolean %checks {
  return (
    isScalarType(type) &&
    specifiedScalarTypes.some(({ name }) => type.name === name)
  );
}
