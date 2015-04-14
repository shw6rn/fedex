var m = mori;

var strucureUrl = "/suite/webapi/structure";
var traceUrl = "/suite/webapi/evaluationTrace";

var styles = {
  selected: {
    backgroundColor: "#A5D1A5",
    borderRadius: 1
  },
  notselected: {
    backgroundColor: "white"
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
        <div>
          <button id="evalbutton" className="fillParent" onClick={this.onClick}>Evaluate</button>
        </div>
        <textarea className="fillParent" value={this.state.expression} onChange={this.onChange}/>
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
    if (!this.state.loaded || this.state.mode == 'input') {
      return <InputPanel onExpressionChange={this.reevaluateExpression}/>
    } else {
      return (
        <div>
          <Controls
            currentIndex={this.state.currentIndex}
            maxIndex={m.count(this.state.snapshots) - 1}
            updateIndexOp={this.updateIndexOp}
            changeToInputMode={this.changeToInputMode}/>
          <Node config={this.state.config}/>
        </div>
      );
    }
  },
  changeToInputMode: function() {
    this.setState({
      mode: 'input'
    });
  },
  reevaluateExpression: function(expression) {
    console.log("calling first ajax call");
    var self = this;
    $.ajax({
      url: strucureUrl,
      dataType: "json",
      type: "GET",
      data: {expression: expression},
      success: function(structure) {
        var initialSnapshot = m.toClj(structure);

        $.ajax({
          url: traceUrl,
          dataType: "json",
          type: "GET",
          data: {expression: expression},
          success: function(trace) {
            var events = m.toClj(trace);
            self.setState({
              config: initialSnapshot,
              snapshots: self.getAllSnapshots(initialSnapshot, events),
              loaded: true,
              currentIndex: 0,
              mode:'debugger'
            });
          }
        });
      },
      error: function(err) {
        console.log(err);
      }
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
        <button className="debugger" onClick={this.goToBeginning}>⇚ Beginning</button>
        <button className="debugger" onClick={this.stepBack}>↲ Step Back</button>
        <button id="inputbutton" className="debugger" onClick={this.changeToInputMode}>Input</button>
        <button className="debugger" onClick={this.step}>Step ↳</button>
        <button className="debugger" onClick={this.goToEnd}>End ⇛</button>
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
  },
  changeToInputMode: function() {
    this.props.changeToInputMode();
  }
});

React.render(
  <App/>,
  document.getElementById('content')
);
