# redux-normalized-entitiy-selector
Enables selecting normalized entities as class with functions from Redux State

Use this along with normalizr (https://github.com/paularmstrong/normalizr) so that you can use this selector to pick entities in your redux store, where the entities are returned as Class objects with functions to select other related entities

## Example

```js
// SchemaDefinition.js
import ormGenerator, { NormalizrSchema } from 'redux-normalized-entitiy-selector'

const user = new NormalizrSchema.Entity('users')
const todo = new schema.Entity('todos')
const file = new schema.Entity('files')
const tag = new schema.Entity('tags')


user.define({
  files: [file],
  todos: [todo]
})

todo.define({
  user
})

file.define({
  user,
  tags: [tag]
})

tag.define({
  files: [file]
})

const Schema = {
  user,
  todo,
  file,
  tag
}

class User {
  fullName() {
    return `${this.firstName} ${this.lastName}`
  }
}

class File {
  hasTags() {
    return this.tags().length > 0
  }
}

const classExtensions = {
  user: User,
  file: File
}

// 'appEntities' is the redux store where normalized entities are stored for the app
const { Selectors: sel, Classes: cla, PropTypes: pt } = ormGenerator(Schemas, classExtensions, 'appEntities')

export { sel as default }
export const Classes = cla
export const PropTypes = pt

// Usage
import Selectors from 'SchemaDefinition.js'

const mapStateToProps = (state, props) => {
  const user = Selectors.user(state, state.client.current_user)
  const tags = Selectors.tags(state, null) // This will return all tags in the redux state
  const files = Selectors.files(state, [1,'2',3]) // This will return files which have the normalized key (identifier) 1,2,3. String or number values
  const todos = user.todos() // This will return all todos which have been assigned to user
  const tagsEmpty = Selectors.tags(state, null, true) // If true is third parameter - null will be assumed as empty array instead of all keys in the entity redux state
  return {
    user,
    tags,
    files,
    todos,
    tagsEmpty
  }
}
```