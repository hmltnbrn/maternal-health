(function() {

  d3.selection.prototype.show = function() {
    this.style('display', 'block');
    return this;
  }

  d3.selection.prototype.showFlex = function() {
    this.style('display', 'flex').style('display', '-webkit-flex');
    return this;
  }

  d3.selection.prototype.hide = function() {
    this.style('display', 'none');
    return this;
  }

  d3.selection.prototype.toggle = function() {
    var isHidden = this.style('display') == 'none';
    this.style('display', isHidden ? 'inherit' : 'none');
    return this;
  }

  d3.selection.prototype.hideToggle = function() {
    var isHidden = this.style('display') == 'none';
    this.style('display', isHidden ? null : 'none');
    return this;
  }

  d3.selection.prototype.check = function() {
    this.property("checked", true);
    this.attr("checked", true);
    return this;
  }

  d3.selection.prototype.uncheck = function() {
    this.property("checked", false);
    this.attr("checked", false);
    return this;
  }

  String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  }

  function responsive(svg) {
    var container = d3.select(svg.node().parentNode),
        width = parseInt(svg.style("width")),
        height = parseInt(svg.style("height")),
        aspect = width / height;

    svg.attr("viewBox", "0 0 " + width + " " + height)
        .attr("perserveAspectRatio", "xMinYMid")
        .call(resize);

    d3.select(window).on("resize." + container.attr("id"), resize);

    function resize() {
        var targetWidth = parseInt(container.style("width"));
        svg.attr("width", targetWidth);
        svg.attr("height", Math.round(targetWidth / aspect));
    }
}

  String.prototype.capitalize = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
  }

  String.prototype.firstToLower = function() {
    return this.charAt(0).toLowerCase() + this.slice(1);
  }

  const margin = { top: 10, right: 20, bottom: 30, left: 30 };

  const width = 960 - margin.left - margin.right;
  const height = 600 - margin.top - margin.bottom;

  const svg = d3.select('#state-chart')
    .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .call(responsive);

  const stateNames = d3.map();
  const stateActions = d3.map();
  const policyDesc = d3.map();
  const allData = d3.map();

  let usMap = false;
  let selectedState = false;
  let selectedPolicy = 'default';

  const path = d3.geoPath();

  const states = svg.append("g")
    .attr("class", "state-container");

  const borders = svg.append("g")
    .attr("class", "border-container");

  const legendSvg = d3.select('#legend-container')
    .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', 150 + margin.top + margin.bottom)
      .call(responsive);

  const dc = svg.append("g")
    .attr("transform", `translate(${width - 40}, ${height - 150})`)
    .attr("class", "dc-group");

  dc.append("text")
    .attr("class","dc-text")
    .attr("x", 24)
    .attr("y", 9)
    .attr("dy", ".35em")
    .text("DC");

  window.onclick = function(event) {
    let isDetail = false;
    for(var i=0;i<event.path.length;i++) {
      if(event.path[i].className === 'detail-container' || event.path[i].className === 'the-notes') {
        isDetail = true;
        break;
      }
    }
    const currentTag = event.target.tagName;
    if(currentTag !== 'path' && currentTag !== 'rect' && currentTag !== 'SELECT' && !isDetail) {
      selectedState = false;
      selectedPolicy = 'default';
      d3.select("#health-selector").selectAll("option").attr("selected", null);
      d3.select("#health-selector").select("option[value='default']").attr("selected", true);
      createMap(usMap, stateActions, 'default');
      setTextBoxes();
    }
  }

  const promises = [
    d3.json("https://d3js.org/us-10m.v1.json"),
    d3.json("https://script.google.com/macros/s/AKfycbztXNRRF5eMOTeYlS6JNDf2DQlqD5rOho6hiECD9sVGMrQnDeA/exec?id=1nik6jVxBoGdvrOtfnbCgfiXejeYdBMYQWCjTKbYwZwo"),
    d3.tsv("../data/state-names.tsv", d => {
      stateNames.set(d.id, d.name);
    })
  ];
  
  Promise.all(promises).then(createAll);

  var selection = document.getElementById("health-selector");

  selection.addEventListener("change", function(e) {
    selectedPolicy = e.target.value;
    if(selectedPolicy === 'default') {
      selectedState = false;
    }
    createMap(usMap, selectedPolicy === 'default' ? stateActions : allData.get(selectedPolicy), selectedPolicy);
    setTextBoxes();
  });

  var toDefault = document.getElementById("to-default");

  toDefault.addEventListener("click", function(e) {
    selectedState = false;
    createMap(usMap, selectedPolicy === 'default' ? stateActions : allData.get(selectedPolicy), selectedPolicy);
    setTextBoxes();
  });
  
  function createAll([us, fullData]) {
    // console.log(fullData)
    usMap = us;
    fullData["State by State Comparison"].forEach(d => {
      stateActions.set(d["State"].trim(), {
        actions: +d["Total_actions"]
      });
    });
    fullData["Policy Descriptions"].forEach(d => {
      policyDesc.set(d["Policy"].trim(), {
        description: d["Description"],
        yes: d["Yes"],
        no: d["No"],
        notes: d["Notes"],
        yes2: d["Yes2"],
        no2: d["No2"]
      });
    });
    for (const key in fullData) {
      if(key !== "State by State Comparison" && key !== "Policy Descriptions") {
        const stateMap = d3.map();
        fullData[key].forEach(d => {
          stateMap.set(d["State"].trim(), d)
        });
        allData.set(key.trim(), stateMap);
      }
    }
    // console.log(stateActions)
    // console.log(policyDesc)
    // console.log(allData)
    createMap(us, stateActions, 'default');
    d3.select(".body-container").showFlex();
    d3.select(".loading-container").hide();
  }
  
  function createMap(us, map, type) {
    const paths = states.selectAll('path')
      .data(topojson.feature(us, us.objects.states).features);
  
    paths.exit().remove();
  
    paths.enter().append("path")
      .merge(paths)
      .attr("fill", d => {
        let sn = stateNames.get(+d.id);
        d.state = sn;
        let col = false;
        if(type === 'default') {
          d.actions = map.get(sn)["actions"] || 0;
          col = getColor(d.actions);
        }
        else if(type === 'Payment Reform') {
          d.actions = Object.keys(map.get(sn)).reduce((sum, key) => {
            if(map.get(sn)[key] === 'Yes') {
              return sum + 1;
            }
            return sum;
          }, 0);
          col = getColor(d.actions);
        }
        else {
          d.value = map.get(sn)["Value"] || 'No';
          col = getColor(d.value);
        }
        if (col) {
          return col;
        } else {
          return '#ffffff';
        }
      })
      .attr("fill-opacity", d => {
        if(!selectedState || d.state === selectedState) {
          return 1;
        }
        return 0.3;
      })
      .attr("d", path)
      .on("click", handleClick);
  
    const state_paths = borders.selectAll('path')
      .data([topojson.mesh(us, us.objects.states, function(a, b) { return a !== b; })]);
  
    state_paths.exit().remove();
  
    state_paths.enter().append("path")
      .attr("class", "states")
      .merge(state_paths)
      .attr("d", path);
    
    const dc_data = dc.selectAll("rect")
      .data([map.get("District of Columbia")]);
  
    dc_data.exit().remove();
  
    dc_data.enter().append("rect")
      .attr("class", "dc-rect")
      .attr("width", 18)
      .attr("height", 18)
      .merge(dc_data)
      .attr("fill", d => {
        d.state = 'District of Columbia';
        let col = false;
        if(type === 'default') {
          d.actions = d["actions"] || 0;
          col = getColor(d.actions); 
        }
        else if(type === 'Payment Reform') {
          d.actions = Object.keys(d).reduce((sum, key) => {
            if(d[key] === 'Yes') {
              return sum + 1;
            }
            return sum;
          }, 0);
          col = getColor(d.actions);
        }
        else {
          d.value = d["Value"] || 'No';
          col = getColor(d.value);
        }
        if (col) {
          return col;
        } else {
          return '#ffffff';
        }
      })
      .attr("fill-opacity", d => {
        if(!selectedState || d.state === selectedState) {
          return 1;
        }
        return 0.3;
      })
      .on("click", handleClick);

    const [legendData, legendCol] = getLegendDetails();

    const legendCircle = legendSvg.selectAll("circle")
      .data(legendCol);

    legendCircle.exit().remove();

    legendCircle.enter()
      .append("circle")
        .attr("cx", 100)
        .attr("cy", (d,i) => { return 40 + i*35; })
        .attr("r", 7)
        .merge(legendCircle)
        .style("fill", d => d);

    const legendText = legendSvg.selectAll("text")
      .data(legendData);

    legendText.exit().remove();

    legendText.enter()
      .append("text")
        .attr("x", 120)
        .attr("y", (d,i) => { return 40 + i*35; })
        .merge(legendText)
        .text(d => d)
        .attr("text-anchor", "left")
        .style("alignment-baseline", "middle");

    function handleClick(d) {
      svg.selectAll("path")
        .attr("fill-opacity", function(d) {
          return 0.3;
        });
      d3.select(".dc-rect")
        .attr("fill-opacity", function(d) {
          return 0.3;
        });
      d3.select(this)
        .attr("fill-opacity", function(d) {
          return 1;
        });
      selectedState = d.state;
      setTextBoxes();
    }

    function getColor(action) {
      if(type === 'default') {
        if(action < 10) {
          return "#d3f4f4";
        }
        else if(action >= 10 && action <= 15) {
          return "#9bdddd";
        }
        else if(action >= 16 && action <= 20) {
          return "#1894ac";
        }
        else if(action > 20) {
          return "#02578c";
        }
      }
      else if(type === 'Payment Reform') {
        if(action === 0) {
          return "#d5d2d1";
        }
        else if (action === 1) {
          return "#9bdddd";
        }
        else if(action === 2) {
          return "#1894ac";
        }
        else if(action === 3) {
          return "#02578c";
        }
      }
      else {
        if(action === 'No') {
          return "#d5d2d1";
        }
        else {
          return "#4abcbc";
        }
      }
    }

    function getLegendDetails() {
      let legendData, legendCol;
      if(type === 'default') {
        legendData = [
          "State has taken fewer than 10 actions to improve maternal health outcomes",
          "State has taken 10-15 actions to improve maternal health outcomes",
          "State has taken 16-20 actions to improve maternal health outcomes",
          "State has taken more than 20 actions to improve maternal health outcomes"
        ];
        legendCol = ["#d3f4f4", "#9bdddd", "#1894ac", "#02578c"];
      }
      else if(type === 'Payment Reform') {
        legendData = [
          "Has not implemented any payment reform actions",
          "Implemented 1 out of 6 payment reform action",
          "Implemented 2 out of 6 payment reform actions",
          "Implemented 3 out of 6 payment reform actions"
        ];
        legendCol = ["#d5d2d1", "#9bdddd", "#1894ac", "#02578c"];
      }
      else {
        legendData = [
          policyDesc.get(selectedPolicy)["no"],
          policyDesc.get(selectedPolicy)["yes"]
        ];
        legendCol = ["#d5d2d1", "#4abcbc"];
      }
      return [legendData, legendCol];
    }
  }

  function setTextBoxes() {
    d3.selectAll(".information-level").hide();
    d3.selectAll(".notes-container").hide();
    if(selectedPolicy === 'default') {
      if(selectedState) {
        d3.select('.full-us').classed('not-selected', true);
        d3.select('.state-name').text(selectedState);
        d3.select(".state-name-container").showFlex();
        const allKeys = allData.keys();
        const policyVals = d3.select(".policy-values");
        policyVals.selectAll('p').remove();
        allKeys.forEach(k => {
          for (const key in allData.get(k).get(selectedState)) {
            if(key.indexOf("Value") >= 0) {
              const keyName = allData.get(k).get(selectedState)[key].trim() + key.replace("Value", "");
              const policyVal = policyDesc.get(k)[keyName.toLowerCase()];
              policyVals
                .append('p')
                .text(policyVal);
            }
          }
        });
        policyVals.showFlex();
      }
      else {
        d3.select('.full-us').classed('not-selected', false);
        d3.select(".default-no-action").showFlex();
        d3.select(".state-name-container").hide();
      }
    }
    else {
      d3.select(".policy-description")
        .text(policyDesc.get(selectedPolicy)["description"])
        .showFlex();
      if(selectedState) {
        d3.select('.full-us').classed('not-selected', true);
        d3.select('.state-name').text(selectedState);
        d3.select(".state-name-container").showFlex();
        if(selectedPolicy === "Payment Reform") {
          const paymentReform = d3.select('.payment-reform').select('ul');
          paymentReform.selectAll('li').remove();
          d3.selectAll('.payment-reform-text').hide();
          let totalYes = 0;
          for (const key in allData.get(selectedPolicy).get(selectedState)) {
            if(key !== "State") {
              if(allData.get(selectedPolicy).get(selectedState)[key] === 'Yes') {
                totalYes += 1;
                paymentReform.append('li').text(key.replace(/_/g, " "));
              }
            }
          }
          d3.selectAll('.payment-reform-state').text(selectedState);
          if(totalYes > 0) {
            d3.select('.yes-payment-reform').show();
          }
          else {
            d3.select('.no-payment-reform').show();
          }
          d3.select('.payment-reform').showFlex();
        }
        else {
          const policyVals = d3.select(".policy-values");
          policyVals.selectAll('p').remove();
          const policyAdd = d3.select(".additional-info-list");
          policyAdd.selectAll('li').remove();
          d3.select(".additional-info").hide();
          const addInfo = [];
          for (const key in allData.get(selectedPolicy).get(selectedState)) {
            if(key.indexOf("Value") >= 0) {
              const keyName = allData.get(selectedPolicy).get(selectedState)[key].trim() + key.replace("Value", "");
              const policyVal = selectedState + " " + policyDesc.get(selectedPolicy)[keyName.toLowerCase()].firstToLower();
              policyVals
                .append('p')
                .text(policyVal);
            }
            if(key === "Status") {
              policyVals
                .append('p')
                .text(allData.get(selectedPolicy).get(selectedState)[key]);
            }
            if(key === 'Effective_Date') {
              const effText = allData.get(selectedPolicy).get(selectedState)[key];
              const date = moment(effText);
              if(effText !== "") {
                d3.select(".policy-effective").showFlex();
                d3.select(".effective-date").text(date.isValid() ? date.format('MMMM Do, YYYY') : effText);
              }
            }
            if(key.indexOf("Additional_Information") >= 0) {
              const aiText = allData.get(selectedPolicy).get(selectedState)[key];
              if(aiText !== "") {
                addInfo.push(aiText);
              }
            }
          }
          policyVals.showFlex();
          if(addInfo.length === 1) {
            d3.select(".additional-info")
              .text(addInfo[0])
              .showFlex();
            d3.select(".policy-additional").showFlex();
          }
          else if(addInfo.length > 0) {
            addInfo.forEach(info => {
              policyAdd
                .append('li')
                .html(`<p>${info}</p>`);
            });
            d3.select(".policy-additional").showFlex();
          }
        }
      }
      else {
        d3.select('.full-us').classed('not-selected', false);
        d3.select(".state-name-container").hide();
        d3.select(".default-no-state").showFlex();
      }
      if(policyDesc.get(selectedPolicy)["notes"] !== "") {
        const splitNotes = policyDesc.get(selectedPolicy)["notes"].split(/\d+\.\s/);
        const notesContainer = d3.select(".the-notes");
        notesContainer.selectAll('p').remove();
        splitNotes.forEach((n, i) => {
          if(n !== "") {
            notesContainer
              .append('p')
              .text(`${i}. ${n}`);
          }
        });
        d3.select(".notes-container").showFlex();
      }
    }
  }

})();
