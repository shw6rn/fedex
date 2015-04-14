var m = mori;

var styles = {
  selected: {
    backgroundColor: "#A5D1A5",
    borderRadius: 1
  },
  notselected: {
    backgroundColor: "white"
  },
  beginning: {

  },
  end: {

  },
  step: {

  },
  step_back: {

  }
};


var Node = React.createClass({
  shouldComponentUpdate: function(nextProps, nextState) {
    return this.props.config != nextProps.config;
  },
  render: function() {
    var config = this.props.config;
    if (m.get(config, "infix")) {
      return this.infixNode(config)
    } else {
      return this.prefixNode(config)
    }
  },
  prefixNode : function(config) {
    var style = this.getStyle(config);
    return (
      <span style={style} title={m.get(config, "value", "NOT EVALUATED YET")}>
        <span>{m.get(config, "prependSource", "")}</span>
        <span>{m.get(config, "textSource", "")}</span>
        <span>{m.get(config, "prependArgs", "")}</span>
        {m.intoArray(m.map(this.createNode, m.get(config, "children")))}
        <span>{m.get(config, "appendArgs", "")}</span>
        <span>{m.get(config, "appendSource", "")}</span>
      </span>
    );
  },
  createNode : function(config) {
    return(
      <Node config={config}/>
    );
  },
  infixNode : function(config) {
    var style = this.getStyle(config);
    return (
      <span style={style} title={m.get(config, "value", "NOT EVALUATED YET")}>
        {this.createNode(m.getIn(config, ["children", 0]))}
        <span>{m.get(config, "prependSource", "")}</span>
        <span>{m.get(config, "textSource", "")}</span>
        <span>{m.get(config, "appendSource", "")}</span>
        {this.createNode(m.getIn(config, ["children", 1]))}
      </span>
    );
  },
  getStyle : function(config) {
    return m.get(config, "evaluated") ? styles.selected : styles.notselected;
  }
});


var InputPanel = React.createClass({
  getInitialState: function() {
    return {
      expression:""
    };
  },
  render: function() {
    return (
      <div>
        <textarea value={this.state.expression} onChange={this.onChange}/>
        <button onClick={this.onClick}>Evaluate</button>
      </div>
    );
  },
  onChange: function(e) {
    this.setState({
      expression:e.target.value
    })
  },
  onClick: function(e) {
    this.props.onExpressionChange(this.state.expression);
  }
});

var App = React.createClass({
  getInitialState: function() {
    return {
      mode:'input',
      loaded: false,
      snapshots: m.vector(),
      config: null,
      currentIndex: -1
    };
  },
  render: function() {
    if (this.state.loaded) {
      var content;
      if (this.state.mode === 'input') {
        content = <InputPanel onExpressionChange={this.reevaluateExpression}/>;
      } else {
        content = <Node config={this.state.config}/>;
      }
      return (
        <div>
          <Controls
            currentIndex={this.state.currentIndex}
            maxIndex={m.count(this.state.snapshots) - 1}
            updateIndexOp={this.updateIndexOp}/>
          {content}
        </div>
      );
    } else {
      return <InputPanel onExpressionChange={this.reevaluateExpression}/>;
    }
  },
  reevaluateExpression: function(expression) {
    console.log("CALL THE SERVER!");
    var initialSnapshot = m.toClj({
      evaluated: false,
      evalPath: [],
      infix: false,
      textSource: "sum",
      children: [
        {
          evaluated: false,
          evalPath: [0],
          textSource: "one",
          appendSource: ","
        },
        {
          evaluated: false,
          evalPath: [1],
          textSource: "two",
          prependSource: " "
        }
      ],
      prependArgs: "(",
      appendArgs: ")"
    });

    var events = m.toClj([
      {
        path: [0],
        value: "one"
      },
      {
        path: [1],
        value: "two"
      },
      {
        path: [],
        value: "three"
      }
    ]);

    this.setState({
      config: initialSnapshot,
      snapshots: this.getAllSnapshots(initialSnapshot, events),
      loaded: true,
      currentIndex: 0,
      mode:'debugger'
    });
  },
  updateIndexOp: function(index) {
    this.setState({
      currentIndex: index,
      config: m.nth(this.state.snapshots, index)
    });
  },
  getAllSnapshots: function(initialSnapshot, events) {
    return m.reduce(this.getSnapshot, m.vector(initialSnapshot), events);
  },
  getSnapshot: function(snapshots, event) {
    var updateDictionary = {
      value: m.get(event, "value"),
      evaluated: true
    };
    var evalPath = m.get(event, "path");
    var lastSnapshot = m.last(snapshots);
    return m.conj(snapshots, this.updateConfig(lastSnapshot, evalPath, updateDictionary));
  },
  updateConfig: function(lastSnapshot, evalPath, value) {
    var childrenList = m.repeat(m.count(evalPath), "children");
    var interleavedEvalPath = m.interleave(childrenList, evalPath);
    var newConfigAtPath = m.getIn(lastSnapshot, interleavedEvalPath);
    for (var key in value) {
      newConfigAtPath = m.assoc(newConfigAtPath, key, value[key])
    }
    var updatedConfig;
    if (m.isEmpty(interleavedEvalPath)) {
      updatedConfig = m.conj(lastSnapshot, interleavedEvalPath, newConfigAtPath)
    } else {
      updatedConfig = m.assocIn(lastSnapshot, interleavedEvalPath, newConfigAtPath)
    }
    return updatedConfig;
  },
});

var Controls = React.createClass({
  render: function() {
    return (
      <div>
        <button style={styles.beginning} onClick={this.goToBeginning}><i className="fa fa-fast-backward"/></button>
        <button style={styles.step_back} onClick={this.stepBack}><i className="fa fa-step-backward"/></button>
        <button style={styles.step} onClick={this.step}><i className="fa fa-step-forward"/></button>
        <button style={styles.end} onClick={this.goToEnd}><i className="fa fa-fast-forward"/></button>
      </div>
   );
  },
  goToBeginning: function() {
    this.props.updateIndexOp(0);
  },
  stepBack: function() {
    var currentIndex = this.props.currentIndex;
    var newIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    this.props.updateIndexOp(newIndex);
  },
  step: function() {
    var currentIndex = this.props.currentIndex;
    var maxIndex = this.props.maxIndex;
    var newIndex = currentIndex < maxIndex ? currentIndex + 1 : maxIndex;
    this.props.updateIndexOp(newIndex);
  },
  goToEnd: function() {
    this.props.updateIndexOp(this.props.maxIndex);
  }
});

React.render(
  <App/>,
  document.getElementById('content')
);
