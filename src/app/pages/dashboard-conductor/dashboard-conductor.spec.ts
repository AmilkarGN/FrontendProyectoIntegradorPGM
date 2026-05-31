import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardConductor } from './dashboard-conductor';

describe('DashboardConductor', () => {
  let component: DashboardConductor;
  let fixture: ComponentFixture<DashboardConductor>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardConductor],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardConductor);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
