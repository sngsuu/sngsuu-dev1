document.addEventListener('DOMContentLoaded', () => {
    const calculateBtn = document.getElementById('calculate-btn');
    const salaryInput = document.getElementById('annual-salary');
    const netMonthlyInput = document.getElementById('net-monthly-salary');
    const dependentsInput = document.getElementById('dependents');
    const tabButtons = document.querySelectorAll('.tab-button');
    const netMonthlyGroup = document.getElementById('net-monthly-group');

    const resultArea = document.getElementById('result-area');
    const monthlyNetSalaryEl = document.getElementById('monthly-net-salary');
    const annualNetSalaryEl = document.getElementById('annual-net-salary');
    const regionCompareEl = document.getElementById('region-compare');
    const regionCompareSubtext = document.getElementById('region-compare-subtext');
    const genderAgeCompareEl = document.getElementById('gender-age-compare');
    const genderAgeCompareSubtext = document.getElementById('gender-age-compare-subtext');
    const regionSelect = document.getElementById('region-select');
    const genderSelect = document.getElementById('gender-select');
    const ageSelect = document.getElementById('age-select');

    const regionDataPath = '/data/region_avg.json';
    const genderAgeDataPath = '/data/gender_age_avg.json';
    let regionAvgData = null;
    let genderAgeAvgData = null;

    const formatAsCurrency = (amount) => {
        return new Intl.NumberFormat('ko-KR').format(Math.round(amount)) + ' 원';
    };

    const formatAsManWon = (amountWon) => {
        return new Intl.NumberFormat('ko-KR').format(Math.round(amountWon / 10000)) + ' 만원';
    };

    const loadAverageData = async () => {
        try {
            const [regionRes, genderRes] = await Promise.all([
                fetch(regionDataPath),
                fetch(genderAgeDataPath)
            ]);
            if (!regionRes.ok || !genderRes.ok) {
                throw new Error('failed to load average data');
            }
            regionAvgData = await regionRes.json();
            genderAgeAvgData = await genderRes.json();
            populateSelectors();
            updateComparisonDisplay();
        } catch (error) {
            regionCompareEl.textContent = '-';
            regionCompareSubtext.textContent = '데이터 로드 실패';
            genderAgeCompareEl.textContent = '-';
            genderAgeCompareSubtext.textContent = '데이터 로드 실패';
        }
    };

    let latestMonthlyNetSalary = null;
    let latestAnnualSalaryMan = null;
    let activeMode = 'annual';

    const computeNetFromGrossMonthly = (grossMonthly, dependents) => {
        const nationalPension = grossMonthly * 0.045;
        const healthInsurance = grossMonthly * 0.03545;
        const longTermCareInsurance = healthInsurance * 0.1281;
        const employmentInsurance = grossMonthly * 0.009;

        let incomeTax = 0;
        const taxBase = grossMonthly - (nationalPension + healthInsurance + employmentInsurance);
        const dependentDeduction = 150000 * (dependents - 1);

        if (taxBase > 8000000) {
            incomeTax = taxBase * 0.20 - dependentDeduction;
        } else if (taxBase > 4000000) {
            incomeTax = taxBase * 0.15 - dependentDeduction;
        } else if (taxBase > 1500000) {
            incomeTax = taxBase * 0.10 - dependentDeduction;
        } else {
            incomeTax = taxBase * 0.06 - dependentDeduction;
        }
        incomeTax = Math.max(0, incomeTax);
        const localIncomeTax = incomeTax * 0.1;

        const totalMonthlyDeduction =
            nationalPension +
            healthInsurance +
            longTermCareInsurance +
            employmentInsurance +
            incomeTax +
            localIncomeTax;

        return grossMonthly - totalMonthlyDeduction;
    };

    const estimateAnnualSalaryFromNetMonthly = (targetNetMonthly, dependents) => {
        if (targetNetMonthly <= 0) {
            return 0;
        }
        let low = 0;
        let high = Math.max(targetNetMonthly * 2, 1000000);

        for (let i = 0; i < 40; i += 1) {
            const netAtHigh = computeNetFromGrossMonthly(high, dependents);
            if (netAtHigh >= targetNetMonthly) {
                break;
            }
            high *= 1.6;
        }

        for (let i = 0; i < 50; i += 1) {
            const mid = (low + high) / 2;
            const net = computeNetFromGrossMonthly(mid, dependents);
            if (net < targetNetMonthly) {
                low = mid;
            } else {
                high = mid;
            }
        }

        const grossMonthly = high;
        return grossMonthly * 12;
    };

    const setCompareOutput = (el, subtextEl, ratio, avgAmount, label) => {
        if (!ratio || !avgAmount) {
            el.textContent = '-';
            subtextEl.textContent = '데이터 로딩 중';
            return;
        }
        el.textContent = `평균 대비 ${ratio.toFixed(1)}%`;
        subtextEl.textContent = `${label} 평균 연봉 ${formatAsManWon(avgAmount)}`;
    };

    const updateComparisonDisplay = () => {
        if (!latestMonthlyNetSalary || latestAnnualSalaryMan === null) {
            return;
        }
        if (!regionAvgData || !genderAgeAvgData) {
            return;
        }

        const annualSalaryWon = latestAnnualSalaryMan * 10000;

        const selectedRegion = regionSelect.value;
        const regionAvg = selectedRegion === '전체'
            ? regionAvgData.overall
            : regionAvgData.regions[selectedRegion];
        if (regionAvg) {
            const ratio = (annualSalaryWon / regionAvg) * 100;
            const label = selectedRegion === '전체' ? '전체' : selectedRegion;
            setCompareOutput(regionCompareEl, regionCompareSubtext, ratio, regionAvg, label);
        } else {
            regionCompareEl.textContent = '-';
            regionCompareSubtext.textContent = '데이터 없음';
        }

        const selectedGender = genderSelect.value;
        const selectedAge = ageSelect.value;
        let genderAgeAvg = null;
        let genderAgeLabel = '전체';

        if (selectedGender === '전체') {
            genderAgeAvg = genderAgeAvgData.overall;
            genderAgeLabel = '전체';
        } else if (selectedAge === '전체') {
            genderAgeAvg = genderAgeAvgData.genderTotals[selectedGender];
            genderAgeLabel = selectedGender;
        } else {
            genderAgeAvg = genderAgeAvgData.byGenderAge[selectedGender]?.[selectedAge];
            genderAgeLabel = `${selectedGender} ${selectedAge}`;
        }

        if (genderAgeAvg) {
            const ratio = (annualSalaryWon / genderAgeAvg) * 100;
            setCompareOutput(genderAgeCompareEl, genderAgeCompareSubtext, ratio, genderAgeAvg, genderAgeLabel);
        } else {
            genderAgeCompareEl.textContent = '-';
            genderAgeCompareSubtext.textContent = '데이터 없음';
        }
    };

    const populateSelectors = () => {
        if (regionAvgData) {
            regionSelect.innerHTML = '';
            const allOption = document.createElement('option');
            allOption.value = '전체';
            allOption.textContent = '전체';
            regionSelect.appendChild(allOption);
            Object.keys(regionAvgData.regions).forEach((region) => {
                const option = document.createElement('option');
                option.value = region;
                option.textContent = region;
                regionSelect.appendChild(option);
            });
        }

        genderSelect.innerHTML = '';
        ['전체', '남성', '여성'].forEach((label) => {
            const option = document.createElement('option');
            option.value = label;
            option.textContent = label;
            genderSelect.appendChild(option);
        });

        updateAgeOptions();
    };

    const updateAgeOptions = () => {
        ageSelect.innerHTML = '';
        const gender = genderSelect.value;
        const baseOption = document.createElement('option');
        baseOption.value = '전체';
        baseOption.textContent = '전체';
        ageSelect.appendChild(baseOption);

        if (!genderAgeAvgData || gender === '전체') {
            return;
        }
        const ages = Object.keys(genderAgeAvgData.byGenderAge[gender] || {});
        ages.forEach((age) => {
            const option = document.createElement('option');
            option.value = age;
            option.textContent = age;
            ageSelect.appendChild(option);
        });
    };

    regionSelect.addEventListener('change', updateComparisonDisplay);
    genderSelect.addEventListener('change', () => {
        updateAgeOptions();
        updateComparisonDisplay();
    });
    ageSelect.addEventListener('change', updateComparisonDisplay);

    loadAverageData();

    tabButtons.forEach((button) => {
        button.addEventListener('click', () => {
            tabButtons.forEach((btn) => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            activeMode = button.dataset.mode;

            if (activeMode === 'annual') {
                salaryInput.parentElement.style.display = 'block';
                netMonthlyGroup.style.display = 'none';
                salaryInput.focus();
            } else {
                salaryInput.parentElement.style.display = 'none';
                netMonthlyGroup.style.display = 'block';
                netMonthlyInput.focus();
            }
        });
    });

    calculateBtn.addEventListener('click', () => {
        const dependents = parseInt(dependentsInput.value, 10);

        let annualSalaryInput = 0;
        if (activeMode === 'annual') {
            annualSalaryInput = parseFloat(salaryInput.value);
            if (isNaN(annualSalaryInput) || annualSalaryInput <= 0) {
                alert('올바른 연봉을 입력해주세요.');
                salaryInput.focus();
                return;
            }
        } else {
            const netMonthlyInputValue = parseFloat(netMonthlyInput.value);
            if (isNaN(netMonthlyInputValue) || netMonthlyInputValue <= 0) {
                alert('올바른 실수령 월급을 입력해주세요.');
                netMonthlyInput.focus();
                return;
            }
            const targetNetMonthly = netMonthlyInputValue * 10000;
            const estimatedAnnualSalary = estimateAnnualSalaryFromNetMonthly(targetNetMonthly, dependents);
            annualSalaryInput = estimatedAnnualSalary / 10000;
        }

        const annualSalary = annualSalaryInput * 10000;

        // 2. 공제액 계산 (단순화된 모델)
        const monthlySalary = annualSalary / 12;

        // 국민연금 (4.5%)
        const nationalPension = monthlySalary * 0.045;
        // 건강보험 (3.545%) + 장기요양 (건강보험의 12.81%)
        const healthInsurance = monthlySalary * 0.03545;
        const longTermCareInsurance = healthInsurance * 0.1281;
        // 고용보험 (0.9%)
        const employmentInsurance = monthlySalary * 0.009;

        // 소득세 (근로소득 간이세액표 기준 단순화)
        let incomeTax = 0;
        const taxBase = monthlySalary - (nationalPension + healthInsurance + employmentInsurance);
        
        // 부양가족 수에 따른 기본 공제 단순화
        const dependentDeduction = 150000 * (dependents - 1); 
        
        // 과세표준에 따른 세율 단순 적용
        if (taxBase > 8000000) {
            incomeTax = taxBase * 0.20 - dependentDeduction;
        } else if (taxBase > 4000000) {
            incomeTax = taxBase * 0.15 - dependentDeduction;
        } else if (taxBase > 1500000) {
            incomeTax = taxBase * 0.10 - dependentDeduction;
        } else {
            incomeTax = taxBase * 0.06 - dependentDeduction;
        }
        incomeTax = Math.max(0, incomeTax); // 세금은 음수가 될 수 없음

        // 지방소득세 (소득세의 10%)
        const localIncomeTax = incomeTax * 0.1;

        const totalMonthlyDeduction =
            nationalPension +
            healthInsurance +
            longTermCareInsurance +
            employmentInsurance +
            incomeTax +
            localIncomeTax;

        // 3. 실수령액 계산
        const monthlyNetSalary = monthlySalary - totalMonthlyDeduction;
        const annualNetSalary = monthlyNetSalary * 12;

        // 4. 결과 표시
        monthlyNetSalaryEl.textContent = formatAsCurrency(monthlyNetSalary);
        annualNetSalaryEl.textContent = formatAsCurrency(annualNetSalary);

        latestMonthlyNetSalary = monthlyNetSalary;
        latestAnnualSalaryMan = annualSalaryInput;
        updateComparisonDisplay();

        resultArea.style.display = 'block';
    });

    const handleEnterKey = (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            calculateBtn.click();
        }
    };

    salaryInput.addEventListener('keydown', handleEnterKey);
    netMonthlyInput.addEventListener('keydown', handleEnterKey);
    dependentsInput.addEventListener('keydown', handleEnterKey);
});
