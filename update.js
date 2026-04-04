const fs = require('fs');

const code = fs.readFileSync('src/pages/coach/ProgramBuilder.tsx', 'utf8');
const searchBefore = 'const primaryGroupItem = groupItems[0];';
const searchAfter = '                            continue;\\n                          }';

const start = code.indexOf(searchBefore);
const end = code.indexOf(searchAfter, start);

if (start === -1 || end === -1) {
  console.log('Not found!');
  process.exit(1);
}

const newCode = searchBefore + \

                            const getGroupIcon = () => {
                              if (groupMode === 'Superset') return <Link2 className=\\\"h-5 w-5 text-[#10b981]\\\" strokeWidth={2.5} />
                              if (groupMode === 'Circuit') return <Repeat className=\\\"h-5 w-5 text-[#10b981]\\\" strokeWidth={2.5} />
                              return <Clock className=\\\"h-5 w-5 text-[#10b981]\\\" strokeWidth={2.5} />
                            }

                            rendered.push(
                              <div key={item.superset_id} className=\\\"mb-6 rounded-[24px] border-2 border-[#10b981]/20 bg-white transition-all overflow-hidden shadow-sm relative pb-4\\\">
                                <div className=\\\"flex items-center justify-between px-5 py-4 border-b border-[#10b981]/10 bg-[#10b981]/[0.03]\\\">
                                  <div className=\\\"flex items-center gap-3\\\">
                                    {getGroupIcon()}
                                    <span className=\\\"text-[15px] font-extrabold text-slate-900\\\">{groupLabel}</span>
                                  </div>
                                  
                                  <div className=\\\"flex items-center gap-4 flex-wrap sm:flex-nowrap\\\">
                                    <div className=\\\"flex items-center gap-2\\\">
                                      <span className=\\\"text-[10px] font-bold uppercase tracking-widest text-[#10b981]/60\\\">Mode</span>
                                      <Select
                                        value={groupMode}
                                        onValueChange={(val) => handleChangeExecutionMode(item.superset_id!, val)}
                                      >
                                        <SelectTrigger className=\\\"h-8 w-[100px] border-transparent bg-white/60 text-xs font-extrabold text-slate-700 shadow-sm focus:ring-0\\\">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className=\\\"rounded-xl border-none shadow-xl\\\">
                                          <SelectItem value=\\\"Superset\\\" className=\\\"text-xs font-bold\\\">Classic</SelectItem>
                                          <SelectItem value=\\\"Circuit\\\" className=\\\"text-xs font-bold\\\">Circuit</SelectItem>
                                          <SelectItem value=\\\"AMRAP\\\" className=\\\"text-xs font-bold\\\">AMRAP</SelectItem>
                                          <SelectItem value=\\\"EMOM\\\" className=\\\"text-xs font-bold\\\">EMOM</SelectItem>
                                          <SelectItem value=\\\"Tabata\\\" className=\\\"text-xs font-bold\\\">Tabata</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>

                                    {groupMode === 'AMRAP' && (
                                      <div className=\\\"flex items-center gap-2 ml-2\\\">
                                        <div className=\\\"flex flex-col items-center\\\">
                                          <span className=\\\"text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5\\\">Total Time (Min)</span>
                                          <Input
                                            value={primaryGroupItem.amrap_duration ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'amrap_duration', parseNumeric(e.target.value))
                                            }
                                            className=\\\"h-8 w-16 text-center text-sm font-bold text-[#10b981] bg-[#10b981]/10 border-transparent focus-visible:ring-[#10b981]/30\\\"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {groupMode === 'EMOM' && (
                                      <div className=\\\"flex items-center gap-2 ml-2\\\">
                                        <div className=\\\"flex flex-col items-center\\\">
                                          <span className=\\\"text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5\\\">Minutes</span>
                                          <Input
                                            value={primaryGroupItem.amrap_duration ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'amrap_duration', parseNumeric(e.target.value))
                                            }
                                            className=\\\"h-8 w-16 text-center text-sm font-bold text-[#10b981] bg-[#10b981]/10 border-transparent focus-visible:ring-[#10b981]/30\\\"
                                          />
                                        </div>
                                      </div>
                                    )}

                                    {groupMode === 'Tabata' && (
                                      <div className=\\\"flex items-center gap-3 ml-2\\\">
                                        <div className=\\\"flex flex-col items-center\\\">
                                          <span className=\\\"text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5\\\">Work (Sec)</span>
                                          <Input
                                            value={primaryGroupItem.tabata_work ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'tabata_work', parseNumeric(e.target.value))
                                            }
                                            className=\\\"h-8 w-14 text-center text-sm font-bold text-[#10b981] bg-[#10b981]/10 border-transparent focus-visible:ring-[#10b981]/30\\\"
                                          />
                                        </div>
                                        <div className=\\\"flex flex-col items-center\\\">
                                          <span className=\\\"text-[9px] font-bold uppercase tracking-widest text-[#10b981] mb-0.5\\\">Rest (Sec)</span>
                                          <Input
                                            value={primaryGroupItem.tabata_rest ?? ''}
                                            onChange={(e) =>
                                              handleUpdateGroupField(item.superset_id!, 'tabata_rest', parseNumeric(e.target.value))
                                            }
                                            className=\\\"h-8 w-14 text-center text-sm font-bold text-[#10b981] bg-[#10b981]/10 border-transparent focus-visible:ring-[#10b981]/30\\\"
                                          />
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                                
                                <div className=\\\"px-5 pt-5 pb-2 bg-[#10b981]/[0.01]\\\">
                                  <div className=\\\"space-y-0\\\">
                                    {groupItems.map(gi => (
                                      <SortableSoloExercise
                                        key={gi.id}
                                        item={gi}
                                        onUpdate={handleUpdateItemField}
                                        onDelete={handleDeleteItem}
                                        isGrouped={true}
                                      />
                                    ))}
                                  </div>
                                  
                                  <div className=\\\"flex justify-center mt-2\\\">
                                    <Button
                                      variant=\\\"ghost\\\"
                                      size=\\\"sm\\\"
                                      onClick={() => handleUngroupItem(item.superset_id!)}
                                      className=\\\"h-8 px-4 rounded-lg text-[10px] font-extrabold uppercase tracking-widest text-[#10b981]/50 hover:bg-slate-50 hover:text-red-500 transition-colors\\\"
                                    >
                                      Dissocier le groupe
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            );
\;

const result = code.substring(0, start) + newCode + '\\n' + code.substring(end);
fs.writeFileSync('src/pages/coach/ProgramBuilder.tsx', result);
console.log('Success');
