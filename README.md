# graphql-non-null-directive

Makes your GraphQL input optional, but not null!

Use version `1.x.x` for graphql-tools 7.  
Use version `2.x.x` for graphql-tools 8.

## The problem

[GraphQL Thread from 2018](https://github.com/graphql/graphql-spec/issues/542)

It's common for Update mutations to accept a partial input, in order to do a partial update.

The simplest version of this is to simply omit the non-nullish (`!`) operator in the input declaration, and not update anything that's nullish:

```graphql
input UpdateUserInput {
  firstName: String
  lastName: String
  country: String
  # ...
}
```

The issue with this is that you lose the ability to say "if provided, this field cannot be null"

With a `@nonNull` directive, you get this ability back:

```graphql
input UpdateUserInput {
  firstName: String @nonNull
  lastName: String @nonNull
  country: String
  # ...
}
```

### Caveats

The `@nonNull` directive cannot be used on Argument Definitions. 
That is because, unlike in Object Inputs, GraphQL.js will always default optional arguments to `null`.

Instead of:

```graphql
# this does not work!
type Mutation {
  updateUser(firstName: String @nonNull): User
}
```

Do:

```graphql
# this works!
type Mutation {
  updateUser(input: UpdateUserInput!): User
}

input UpdateUserInput {
  firstName: String @nonNull
  # ...
}
```

## Usage

**NB: This library is built using graphql-tools and should be compatible with apollo*

- Install from npm: [`npm i @ephys/graphql-non-null-directive`](https://www.npmjs.com/package/@ephys/graphql-non-null-directive)
- Declare the directive in your schema: 
    ```graphql
    directive @nonNull on INPUT_FIELD_DEFINITION
    ```
- Declare the directive in your Apollo Server:
    ```typescript
    import { createNonNullDirective } from '@ephys/graphql-non-null-directive';
  
    const server = new ApolloServer({
      // ...
      schemaDirectives: { 
        nonNull: createNonNullDirective({
          // (optional) use this property to change the ID of the directive
          directiveName: 'nonNull',
          // (optional) use this property to configure how Input Errors are built
          //  Input Errors are thrown when a @nonNull input received null..
          buildInputError: (message: string) => {
            return new Error(message);
          },
        }),
      },
    });
    ```
