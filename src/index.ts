import {
  defaultFieldResolver,
  GraphQLError,
  GraphQLInputField,
  GraphQLInputObjectType,
  GraphQLNonNull,
  GraphQLObjectType,
} from 'graphql';
import { SchemaDirectiveVisitor, SchemaDirectiveVisitorClass } from 'graphql-tools';
import get from 'lodash/get';

/*
 * This @nonNull directive can be used on input fields that you want to make OPTIONAL but not NULLABLE
 * Use it as a replacement for the required ("!") operator in such cases.
 */

type TCreateDirectiveOptions = {
  directiveName?: string,
  buildInputError?: (message: string) => any,
};

export function createNonNullDirective(opts?: TCreateDirectiveOptions): SchemaDirectiveVisitorClass {
  const directiveName = opts?.directiveName ?? 'nonNull';
  const buildInputError = opts?.buildInputError ?? ((message: string) => new GraphQLError(message));

  const processedSchemas = new WeakSet();

  class NonNullDirective extends SchemaDirectiveVisitor {
    visitInputFieldDefinition(visitedInputField, options) {
      this.#checkField(visitedInputField, options.objectType);
      this.#processSchema();
    }

    #processSchema() {
      if (processedSchemas.has(this.schema)) {
        return;
      }

      // @nonNull tags inputs (parameters)
      // but the only way to enforce @nonNull is to transform the `resolve` function of the field that use the input.
      // GraphQl.js doesn't give us the list of fields that use a given input,
      // so we're iterating the whole schema to find them

      const typeMap = this.schema.getTypeMap(); // checking `input {}` definition

      function checkInputObject(inputType: GraphQLInputObjectType, taggedInputs, prefix = []) {
        for (const field of Object.values(inputType.getFields())) {
          // find nested objects
          // unpack "!" operator
          let fieldType = field.type;

          if (fieldType instanceof GraphQLNonNull) {
            fieldType = fieldType.ofType;
          }

          if (fieldType instanceof GraphQLInputObjectType) {
            // sub-input objects
            checkInputObject(fieldType, taggedInputs, [...prefix, field.name]);
          } // find @nonNull directives
          // this is the tagged input property!

          const isNonNull = field.astNode.directives.find(d => d.name.value === directiveName);

          if (isNonNull) {
            taggedInputs.push([...prefix, field.name]);
          }
        }
      }

      for (const type of Object.values(typeMap)) {
        if (!(type instanceof GraphQLObjectType)) {
          continue;
        }

        for (const field of Object.values(type.getFields())) {
          const taggedInputs = [];

          for (const arg of field.args) {
            let argType = arg.type; // Unpack the "!" operator
            // NB. we're not unpacking lists because @nonNull does not make sense inside the list, use "!" for that.
            //  so @nonNull only tags the list itself

            if (argType instanceof GraphQLNonNull) {
              argType = argType.ofType;
            }

            if (argType instanceof GraphQLInputObjectType) {
              checkInputObject(argType, taggedInputs, [arg.name]);
            }
          }

          if (taggedInputs.length > 0) {
            taggedInputs.sort((a, b) => a.length - b.length);
            const {
              resolve = defaultFieldResolver,
            } = field;

            field.resolve = function resolveFn(...resolverArgs) {
              const fieldArgs = resolverArgs[1];

              for (const inputPath of taggedInputs) {
                // only throw if === null, because then:
                // if an object has an optional property, which itself has a required property,
                //  don't throw if the optional property is missing, but do if the nested one is
                if (get(fieldArgs, inputPath) === null) {
                  throw buildInputError(`${inputPath.join('.')} cannot be null`);
                }
              }

              return resolve.apply(this, resolverArgs);
            };
          }
        }
      }

      processedSchemas.add(this.schema);
    }

    #checkField(field: GraphQLInputField, objectType: GraphQLObjectType) {
      const fieldName = field.astNode.name.value;

      if (field.type instanceof GraphQLNonNull) {
        throw new Error(`@${directiveName} cannot be used on a field that is already non-nullish (! operator): field "${fieldName}: ${field.type}" on input ${objectType.name}`);
      }

      return field;
    }
  }

  return NonNullDirective;
}
