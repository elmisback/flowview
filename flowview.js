class NotDefined extends Error {}
class ParentNotDefined extends Error {}
class InputsNotDefined extends Error {
  constructor (msg) {
    super(msg)
    this.name = 'InputsNotDefined'
  }
}
const log = console.log
const VIEW = '__VIEW'
const NodeError = (chain, error) => ({chain, error, __is_an_error: true})

const define = (name, fn, ...args) => {
  if (typeof fn === 'function' && fn.length != args.length) 
    throw Error(`${fn} takes ${fn.length} args, ${args.length} given`)
  return DefinitionStack([{name, fn, args}])  // (This is a definition object inside the list.)
}

function DefinitionStack (definitions, observers=[]) {
  const Hole = idx => ({idx, __is_a_hole: true})
  const ContainsHole = fn => ({fn, __contains_a_hole: true})

  const query = (name, holes=[]) => {
    
    if (holes.includes(name)) return Hole(holes.indexOf(name))
    
    const def = definitions.find(e => e.name == name)
    if (!def) throw new NotDefined(name)
    
    let {fn, args} = def
    let old_fn = fn
    fn = 
        fn === VIEW ? VIEW 
      : args.length > 0 || typeof fn === 'function' ? fn 
      : () => old_fn      // wrap values as functions. Zero-argument functions are not permitted as values.
    args = args.map(arg => holes.includes(arg) ? Hole(holes.indexOf(arg)) : arg)
    
    let undefined_inputs = []
    const resolve = (name, holes) => {
      try {
        return query(name, holes)
      } catch (e) {
        log(e)
        if (e instanceof NotDefined) {
          undefined_inputs.push(name)
        } else {
          throw e
        }
      }
    }
    
    if (fn === VIEW) {
      let [view_fn, ...view_holes] = args    // could refactor to use proper view definitions
      return resolve(view_fn, [...view_holes, ...holes]).fn
    }
    
    log(5, name, fn, args)
    
    fn = args.length == 0 || typeof fn === 'function' || fn.__is_a_hole ? fn : resolve(fn, holes)
    args = args.map(arg => arg.__is_a_hole ? arg : resolve(arg, holes) )
    
    log(1, name, fn, args, undefined_inputs)
    
    if (undefined_inputs.length > 0)
      throw new InputsNotDefined(undefined_inputs.join(','))
    
    let err = [fn, ...args].find(v => v.__is_an_error)
    if (err !== undefined) return NodeError([...err.chain, name], err.error)

    if (args.some(arg => arg.__is_a_hole || arg.__contains_a_hole) || fn.__is_a_hole) {
      log(3, name, fn, args)
      return ContainsHole((...view_args) => {
        log(4, name, fn, args, view_args)
        return (fn.__is_a_hole ? view_args[fn.idx] : fn)
          (...args.map(arg =>   arg.__is_a_hole ? view_args[arg.idx] 
                              : arg.__contains_a_hole ? arg.fn(...view_args) 
                              : arg))
      })
    }

    try {
      return (fn.__contains_a_hole ? fn.fn : fn)(...args)
    } catch (e) {
      return NodeError([name], e)
    }
  }

  // Naively update all observers whenever a new definition is created.
  observers.map(observer => observer.callback(query(observer.name)))
  
  return {
    definitions,
    observers,
    and: stack2 => DefinitionStack([ ...stack2.definitions, ...definitions], [...stack2.observers, ...observers]),
    query,
    observe: (name, callback) => DefinitionStack(definitions, [{ name, callback }, ...observers])
  }
}
